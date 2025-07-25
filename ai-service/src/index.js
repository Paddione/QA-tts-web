require('dotenv').config();

const DatabaseManager = require('./database');
const GeminiClient = require('./gemini-client');
const { v4: uuidv4 } = require('uuid');

// Add correlation ID to console logs
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => originalLog(`[AI-${process.pid}]`, ...args);
console.error = (...args) => originalError(`[AI-${process.pid}]`, ...args);
console.warn = (...args) => originalWarn(`[AI-${process.pid}]`, ...args);

class AIService {
    constructor() {
        this.db = new DatabaseManager();
        this.gemini = null;
        this.isRunning = false;
    }

    async start() {
        console.log('🚀 Starting AI Processing Service...');

        // Validate environment variables
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY environment variable is required');
            process.exit(1);
        }

        // Initialize Gemini client
        try {
            this.gemini = new GeminiClient(
                process.env.GEMINI_API_KEY,
                process.env.GEM_ID
            );
            console.log('🤖 Gemini client initialized');
            
            // In debug mode, list available models
            if (process.env.DEBUG === 'true') {
                console.log('🔍 Debug mode: Listing available models...');
                await this.gemini.listModels();
            }
        } catch (error) {
            console.error('❌ Failed to initialize Gemini client:', error.message);
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

        // Start listening for new questions
        await this.startListening();

        this.isRunning = true;
        console.log('✅ AI Processing Service is running and ready to process questions');

        // Test Gemini API connection
        try {
            await this.gemini.test();
        } catch (error) {
            console.warn('⚠️ Gemini API test failed, but service will continue running');
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
            await this.db.listen('new_question', async (questionId) => {
                await this.processQuestion(questionId);
            });
        } catch (error) {
            console.error('❌ Failed to start listening for notifications:', error.message);
            // Try to reconnect and listen again
            setTimeout(() => this.startListening(), 5000);
        }
    }

    async processQuestion(questionId) {
        const correlationId = uuidv4().substring(0, 8);
        const startTime = Date.now();
        
        try {
            console.log(`📝 [${correlationId}] Processing question ID: ${questionId}`);

            // Get the question from database
            const record = await this.db.getQuestion(questionId);
            if (!record) {
                console.warn(`⚠️ [${correlationId}] Question with ID ${questionId} not found`);
                return;
            }

            if (record.answer) {
                console.log(`ℹ️ [${correlationId}] Question ${questionId} already has an answer, skipping`);
                return;
            }

            console.log(`❓ [${correlationId}] Question: "${record.question.substring(0, 100)}..."`);

            // Generate answer using Gemini
            const answer = await this.gemini.generateAnswer(record.question);

            // Update database with the answer
            await this.db.updateAnswer(questionId, answer);

            const duration = Date.now() - startTime;
            console.log(`✅ [${correlationId}] Successfully processed question ${questionId} in ${duration}ms`);
            console.log(`💬 [${correlationId}] Answer: "${answer.substring(0, 200)}${answer.length > 200 ? '...' : ''}"`);

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [${correlationId}] Error processing question ${questionId} after ${duration}ms:`, error.message);
            
            // Optionally update database with error status (truncate long error messages)
            try {
                const errorMessage = error.message || 'Unknown error';
                const truncatedError = errorMessage.length > 150 ? 
                    `Error: Failed to generate answer - ${errorMessage.substring(0, 150)}...` : 
                    `Error: Failed to generate answer - ${errorMessage}`;
                
                await this.db.updateAnswer(questionId, truncatedError);
            } catch (dbError) {
                console.error(`❌ [${correlationId}] Failed to update database with error:`, dbError.message);
            }
        }
    }

    // Health check method
    async healthCheck() {
        try {
            const dbHealth = this.db.isConnected;
            const geminiHealth = this.gemini ? true : false;
            
            return {
                status: 'healthy',
                service: 'ai-service',
                timestamp: new Date().toISOString(),
                database: { connected: dbHealth },
                gemini: { initialized: geminiHealth },
                uptime: process.uptime()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                service: 'ai-service',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop() {
        console.log('🛑 Stopping AI Processing Service...');
        this.isRunning = false;
        await this.db.close();
        console.log('✅ AI Processing Service stopped');
    }
}

// Handle graceful shutdown
const aiService = new AIService();

process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await aiService.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await aiService.stop();
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
aiService.start().catch((error) => {
    console.error('💥 Failed to start AI service:', error);
    process.exit(1);
}); 