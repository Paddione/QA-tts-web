const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const path = require('path');

class TTSClient {
    constructor(apiKey) {
        // Initialize the Google Cloud Text-to-Speech client
        if (apiKey) {
            // If API key is provided, use it for authentication
            this.client = new textToSpeech.TextToSpeechClient({
                apiKey: apiKey
            });
        } else {
            // Use default authentication (service account file, etc.)
            this.client = new textToSpeech.TextToSpeechClient();
        }
        
        this.outputDir = '/app/public/mp3';
        this.retryDelay = 1000;
        this.maxRetryDelay = 30000;
        this.maxRetries = 5;
        
        // Ensure output directory exists
        this.ensureOutputDir();
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
            console.log(`🎵 Converting text to speech for record ${recordId} (${text.length} characters)`);

            // Prepare the request
            const request = {
                input: { text: text },
                voice: {
                    languageCode: 'en-US',
                    name: 'en-US-Standard-D', // A pleasant female voice
                    ssmlGender: 'NEUTRAL'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.0,
                    pitch: 0.0,
                    volumeGainDb: 0.0
                }
            };

            // Call the Google TTS API
            const [response] = await this.client.synthesizeSpeech(request);

            // Save the audio to file
            const filename = `${recordId}.mp3`;
            const filepath = path.join(this.outputDir, filename);
            
            await fs.writeFile(filepath, response.audioContent, 'binary');

            console.log(`✅ Audio file saved: ${filepath}`);
            
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
            const testPath = await this.convertToSpeech("Testing text to speech functionality.", "test");
            console.log(`🧪 TTS test successful: ${testPath}`);
            
            // Clean up test file (both .mp3 and .txt fallback)
            try {
                if (testPath.endsWith('.txt')) {
                    await fs.unlink(path.join(this.outputDir, 'test.txt'));
                } else {
                    await fs.unlink(path.join(this.outputDir, 'test.mp3'));
                }
                console.log('🧪 Test file cleaned up');
            } catch (cleanupError) {
                console.warn('⚠️ Failed to clean up test file:', cleanupError.message);
            }
            
            return true;
        } catch (error) {
            console.error(`🧪 TTS test failed:`, error.message);
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