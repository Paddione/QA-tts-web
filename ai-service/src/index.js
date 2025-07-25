require('dotenv').config();

const DatabaseManager = require('./database');
const HybridAIService = require('./hybrid-ai-service');
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
        this.hybridAI = null;
        this.isRunning = false;
    }

    async start() {
        console.log('🚀 Starting AI Processing Service...');

        // Initialize Hybrid AI service
        try {
            this.hybridAI = new HybridAIService(this.db);
            console.log('🤖 Hybrid AI service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Hybrid AI service:', error.message);
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

        // Test AI service connections
        try {
            await this.hybridAI.test();
        } catch (error) {
            console.warn('⚠️ AI service test failed, but service will continue running');
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
        
        try {
            console.log(`📝 [${correlationId}] Processing question ID: ${questionId}`);

            // Use hybrid AI service to process the question
            const result = await this.hybridAI.processQuestion(questionId);

            console.log(`✅ [${correlationId}] Successfully processed question ${questionId} using ${result.source || 'hybrid'} AI`);

        } catch (error) {
            console.error(`❌ [${correlationId}] Error processing question ${questionId}:`, error.message);
            // Error handling is done inside the hybrid service
        }
    }

    // Health check method
    async healthCheck() {
        try {
            const dbHealth = this.db.isConnected;
            let aiStatus = null;
            
            if (this.hybridAI) {
                aiStatus = await this.hybridAI.getSystemStatus();
            }
            
            return {
                status: 'healthy',
                service: 'ai-service',
                timestamp: new Date().toISOString(),
                database: { connected: dbHealth },
                ai: aiStatus,
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