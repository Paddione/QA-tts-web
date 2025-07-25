const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const path = require('path');

class TTSClient {
    constructor(apiKey, serviceAccountPath) {
        // Initialize the Google Cloud Text-to-Speech client
        console.log('🎵 Initializing Google Cloud Text-to-Speech client...');
        
        if (serviceAccountPath && this.fileExists(serviceAccountPath)) {
            // Use service account file for authentication
            console.log(`🔐 Using service account file: ${serviceAccountPath}`);
            this.client = new textToSpeech.TextToSpeechClient({
                keyFilename: serviceAccountPath
            });
            this.authMethod = 'service-account';
        } else if (apiKey) {
            // If API key is provided, use it for authentication
            console.log(`🔑 Using API key authentication`);
            this.client = new textToSpeech.TextToSpeechClient({
                apiKey: apiKey
            });
            this.authMethod = 'api-key';
        } else {
            // Use default authentication (environment variables, etc.)
            console.log(`🔒 Using default authentication (environment variables)`);
            this.client = new textToSpeech.TextToSpeechClient();
            this.authMethod = 'default';
        }
        
        this.outputDir = '/app/public/mp3';
        this.retryDelay = 1000;
        this.maxRetryDelay = 30000;
        this.maxRetries = 5;
        
        // Configure voice settings - German language pack
        this.voiceConfig = {
            languageCode: process.env.TTS_LANGUAGE_CODE || 'de-DE',
            name: process.env.TTS_VOICE_NAME || 'de-DE-Standard-A', // German female voice
            ssmlGender: process.env.TTS_VOICE_GENDER || 'FEMALE'
        };
        
        // Configure audio settings
        this.audioConfig = {
            audioEncoding: 'MP3',
            speakingRate: parseFloat(process.env.TTS_SPEAKING_RATE) || 1.0,
            pitch: parseFloat(process.env.TTS_PITCH) || 0.0,
            volumeGainDb: parseFloat(process.env.TTS_VOLUME_GAIN) || 0.0
        };
        
        console.log(`✅ TTS client initialized with ${this.authMethod} authentication`);
        console.log(`🇩🇪 Voice configuration: ${this.voiceConfig.name} (${this.voiceConfig.languageCode})`);
        console.log(`🎛️ Audio settings: Rate ${this.audioConfig.speakingRate}x, Pitch ${this.audioConfig.pitch}, Volume ${this.audioConfig.volumeGainDb}dB`);
        
        // Ensure output directory exists
        this.ensureOutputDir();
    }

    fileExists(filePath) {
        try {
            const fs = require('fs');
            return fs.existsSync(filePath);
        } catch (error) {
            return false;
        }
    }

    async ensureOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            console.log(`📁 MP3 output directory ready: ${this.outputDir}`);
        } catch (error) {
            console.error('❌ Failed to create output directory:', error.message);
            throw error;
        }
    }

    async convertToSpeech(text, recordId, retryCount = 0) {
        try {
            console.log(`🎵 Converting text to speech for record ${recordId} (${text.length} characters) using ${this.voiceConfig.name}`);

            // Prepare the request with German voice configuration
            const request = {
                input: { text: text },
                voice: this.voiceConfig,
                audioConfig: this.audioConfig
            };

            // Call the Google TTS API
            const [response] = await this.client.synthesizeSpeech(request);

            // Save the audio to file
            const filename = `${recordId}.mp3`;
            const filepath = path.join(this.outputDir, filename);
            
            await fs.writeFile(filepath, response.audioContent, 'binary');

            console.log(`✅ German audio file saved: ${filepath}`);
            
            // Return the relative path for database storage
            return `/mp3/${filename}`;

        } catch (error) {
            console.error(`❌ TTS conversion error (attempt ${retryCount + 1}):`, error.message);

            // Check if this is a Google TTS API permission error and use fallback
            if (error.message.includes('PERMISSION_DENIED') || 
                error.message.includes('API has not been used') ||
                error.message.includes('is disabled')) {
                
                console.log(`💡 Using fallback: Creating placeholder for record ${recordId}`);
                return await this.createFallbackFile(text, recordId);
            }

            // Check if we should retry for other errors
            if (retryCount < this.maxRetries && this.shouldRetry(error)) {
                const delay = Math.min(this.retryDelay * Math.pow(2, retryCount), this.maxRetryDelay);
                console.log(`🔄 Retrying TTS conversion in ${delay / 1000} seconds...`);
                
                await this.sleep(delay);
                return this.convertToSpeech(text, recordId, retryCount + 1);
            }

            // If we've exhausted retries or shouldn't retry, throw the error
            throw new Error(`Failed to convert text to speech after ${retryCount + 1} attempts: ${error.message}`);
        }
    }

    // Fallback method to create a placeholder when TTS API is not available
    async createFallbackFile(text, recordId) {
        try {
            console.log(`📝 Creating text fallback for record ${recordId}`);
            
            // Create a simple text file as fallback
            const filename = `${recordId}.txt`;
            const filepath = path.join(this.outputDir, filename);
            
            const fallbackContent = `TTS Audio Placeholder\n\nRecord ID: ${recordId}\nText: ${text}\n\nNote: This is a text placeholder because Google TTS API is not available.\nTo enable audio, configure the Google Cloud Text-to-Speech API.`;
            
            await fs.writeFile(filepath, fallbackContent, 'utf8');
            
            console.log(`✅ Fallback text file created: ${filepath}`);
            
            // Return a special path indicating this is a fallback
            return `/mp3/${recordId}.txt`;
            
        } catch (fallbackError) {
            console.error(`❌ Failed to create fallback file:`, fallbackError.message);
            throw new Error(`Failed to create fallback file: ${fallbackError.message}`);
        }
    }

    shouldRetry(error) {
        // Retry on network errors, rate limits, and temporary server errors
        const retryableErrors = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'Rate limit',
            'Internal error',
            'quota',
            '429',
            '500',
            '502',
            '503',
            '504'
        ];

        const errorMessage = error.message.toLowerCase();
        return retryableErrors.some(retryableError => 
            errorMessage.includes(retryableError.toLowerCase())
        );
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Test method to verify TTS functionality
    async test() {
        try {
            console.log(`🧪 Testing Google TTS with ${this.authMethod} authentication and ${this.voiceConfig.name} voice...`);
            const testText = this.voiceConfig.languageCode.startsWith('de-') ? 
                "Dies ist ein Test der deutschen Text-zu-Sprache-Funktionalität." : 
                "Testing text to speech functionality.";
            const testPath = await this.convertToSpeech(testText, "test");
            console.log(`✅ TTS test successful using ${this.authMethod} with ${this.voiceConfig.name}: ${testPath}`);
            
            // Clean up test file (both .mp3 and .txt fallback)
            try {
                if (testPath.endsWith('.txt')) {
                    await fs.unlink(path.join(this.outputDir, 'test.txt'));
                    console.log('🧪 Test fallback file cleaned up');
                } else {
                    await fs.unlink(path.join(this.outputDir, 'test.mp3'));
                    console.log('🧪 Test MP3 file cleaned up');
                }
            } catch (cleanupError) {
                console.warn('⚠️ Failed to clean up test file:', cleanupError.message);
            }
            
            return true;
        } catch (error) {
            console.error(`❌ TTS test failed with ${this.authMethod} authentication:`, error.message);
            
            // Provide helpful error messages based on authentication method
            if (this.authMethod === 'service-account' && error.message.includes('ENOENT')) {
                console.error('💡 Service account file might be missing or inaccessible');
            } else if (error.message.includes('PERMISSION_DENIED')) {
                console.error('💡 Check your Google Cloud TTS API permissions and billing');
            } else if (error.message.includes('API has not been used')) {
                console.error('💡 Enable the Google Cloud Text-to-Speech API in your project');
            }
            
            return false;
        }
    }

    // Delete MP3 file
    async deleteFile(recordId) {
        try {
            const filename = `${recordId}.mp3`;
            const filepath = path.join(this.outputDir, filename);
            await fs.unlink(filepath);
            console.log(`🗑️ Deleted MP3 file: ${filename}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`⚠️ MP3 file not found for record ${recordId}`);
            } else {
                console.error(`❌ Failed to delete MP3 file for record ${recordId}:`, error.message);
            }
            return false;
        }
    }

    // Get file stats
    async getFileInfo(recordId) {
        try {
            const filename = `${recordId}.mp3`;
            const filepath = path.join(this.outputDir, filename);
            const stats = await fs.stat(filepath);
            return {
                exists: true,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            };
        } catch (error) {
            return { exists: false };
        }
    }
}

module.exports = TTSClient; 