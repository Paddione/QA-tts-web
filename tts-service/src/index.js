require('dotenv').config();

const DatabaseManager = require('./database');
const TTSClient = require('./tts-client');
const { v4: uuidv4 } = require('uuid');

// Add correlation ID to console logs
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => originalLog(`[TTS-${process.pid}]`, ...args);
console.error = (...args) => originalError(`[TTS-${process.pid}]`, ...args);
console.warn = (...args) => originalWarn(`[TTS-${process.pid}]`, ...args);

class TTSService {
    constructor() {
        this.db = new DatabaseManager();
        this.tts = null;
        this.isRunning = false;
    }

    async start() {
        console.log('🚀 Starting TTS Service...');

        // Initialize TTS client
        try {
            this.tts = new TTSClient(
                process.env.GOOGLE_TTS_KEY, 
                process.env.GOOGLE_APPLICATION_CREDENTIALS
            );
            console.log('🎵 TTS client initialized');
        } catch (error) {
            console.error('❌ Failed to initialize TTS client:', error.message);
            process.exit(1);
        }

        // Connect to database
        const connected = await this.db.connect();
        if (!connected) {
            console.error('❌ Failed to connect to database on startup');
            // Don't exit - let it retry in the background
        }

        // Wait for database to be ready before starting to listen
        await this.waitForDatabase();

        // Start listening for new answers
        await this.startListening();

        this.isRunning = true;
        console.log('✅ TTS Service is running and ready to convert answers to speech');

        // Test TTS functionality
        try {
            await this.tts.test();
        } catch (error) {
            console.warn('⚠️ TTS test failed, but service will continue running');
        }
    }

    async waitForDatabase() {
        const maxWaitTime = 60000; // 60 seconds
        const checkInterval = 5000; // 5 seconds
        let elapsed = 0;

        while (!this.db.isConnected && elapsed < maxWaitTime) {
            console.log('⏳ Waiting for database connection...');
            await this.sleep(checkInterval);
            elapsed += checkInterval;
        }

        if (!this.db.isConnected) {
            console.error('❌ Database connection timeout');
            process.exit(1);
        }
    }

    async startListening() {
        try {
            await this.db.listen('new_answer', async (recordId) => {
                await this.processAnswer(recordId);
            });
        } catch (error) {
            console.error('❌ Failed to start listening for notifications:', error.message);
            // Try to reconnect and listen again
            setTimeout(() => this.startListening(), 5000);
        }
    }

    async processAnswer(recordId) {
        const correlationId = uuidv4().substring(0, 8);
        const startTime = Date.now();
        
        try {
            console.log(`🎵 [${correlationId}] Processing answer for record ID: ${recordId}`);

            // Get the answer from database
            const record = await this.db.getAnswer(recordId);
            if (!record) {
                console.warn(`⚠️ [${correlationId}] Record with ID ${recordId} not found`);
                return;
            }

            if (!record.answer) {
                console.warn(`⚠️ [${correlationId}] Record ${recordId} has no answer text`);
                return;
            }

            if (record.mp3path) {
                console.log(`ℹ️ [${correlationId}] Record ${recordId} already has an MP3 file, skipping`);
                return;
            }

            console.log(`💬 [${correlationId}] Answer text: "${record.answer.substring(0, 200)}${record.answer.length > 200 ? '...' : ''}"`);

            // Convert answer to speech
            const mp3Path = await this.tts.convertToSpeech(record.answer, recordId);

            // Update database with MP3 path
            await this.db.updateMp3Path(recordId, mp3Path);

            const duration = Date.now() - startTime;
            console.log(`✅ [${correlationId}] Successfully processed answer for record ${recordId} in ${duration}ms`);
            console.log(`🎵 [${correlationId}] MP3 file: ${mp3Path}`);

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [${correlationId}] Error processing answer for record ${recordId} after ${duration}ms:`, error.message);
            
            // Optionally update database with error status (truncate long error messages)
            try {
                const errorMessage = error.message || 'Unknown error';
                const truncatedError = errorMessage.length > 200 ? 
                    `ERROR: ${errorMessage.substring(0, 200)}...` : 
                    `ERROR: ${errorMessage}`;
                
                await this.db.updateMp3Path(recordId, truncatedError);
            } catch (dbError) {
                console.error(`❌ [${correlationId}] Failed to update database with error:`, dbError.message);
            }
        }
    }

    // Health check method
    async healthCheck() {
        try {
            const dbHealth = this.db.isConnected;
            const ttsHealth = this.tts ? true : false;
            
            return {
                status: 'healthy',
                service: 'tts-service',
                timestamp: new Date().toISOString(),
                database: { connected: dbHealth },
                tts: { initialized: ttsHealth },
                uptime: process.uptime()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                service: 'tts-service',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop() {
        console.log('🛑 Stopping TTS Service...');
        this.isRunning = false;
        await this.db.close();
        console.log('✅ TTS Service stopped');
    }
}

// Handle graceful shutdown
const ttsService = new TTSService();

process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await ttsService.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await ttsService.stop();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the service
ttsService.start().catch((error) => {
    console.error('💥 Failed to start TTS service:', error);
    process.exit(1);
}); 