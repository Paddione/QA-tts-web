const EnhancedAIClient = require('./enhanced-ai-client');
const GeminiClient = require('./gemini-client');

class HybridAIService {
    constructor(db) {
        this.db = db;
        this.enhancedClient = null;
        this.geminiClient = null;
        this.useEnhanced = process.env.USE_ENHANCED_AI === 'true';
        this.fallbackToLocal = process.env.FALLBACK_TO_LOCAL_AI === 'true';
        
        // Only initialize Enhanced AI client if needed
        if (this.useEnhanced) {
            this.enhancedClient = new EnhancedAIClient();
        }
        
        // Initialize Gemini client if needed
        if (!this.useEnhanced || this.fallbackToLocal) {
            try {
                this.geminiClient = new GeminiClient(
                    process.env.GEMINI_API_KEY,
                    process.env.GEM_ID
                );
                console.log('🤖 Gemini fallback client initialized');
            } catch (error) {
                console.warn('⚠️ Failed to initialize Gemini fallback client:', error.message);
            }
        }
        
        console.log(`🔧 Hybrid AI Service configured:`);
        console.log(`  Enhanced AI: ${this.useEnhanced ? 'enabled' : 'disabled'}`);
        console.log(`  Fallback to local: ${this.fallbackToLocal ? 'enabled' : 'disabled'}`);
    }

    async processQuestion(questionId) {
        const startTime = Date.now();
        let processingMethod = 'unknown';
        let usedRag = false;
        let ragSources = [];

        try {
            if (this.useEnhanced) {
                try {
                    console.log(`🚀 Using enhanced AI service for question ${questionId}`);
                    
                    // Try to use enhanced AI service
                    const result = await this.enhancedClient.processQuestion(questionId);
                    
                    if (result && result.success) {
                        processingMethod = 'enhanced';
                        usedRag = result.used_rag || false;
                        ragSources = result.rag_sources || [];
                        
                        // Update database with the enhanced AI result
                        await this.updateAnswer(questionId, result.answer, processingMethod, Date.now() - startTime, usedRag, ragSources);
                        
                        console.log(`✅ Enhanced AI successfully processed question ${questionId}`);
                        return result;
                    } else {
                        throw new Error('Enhanced AI returned unsuccessful result');
                    }
                    
                } catch (error) {
                    console.error(`❌ Enhanced AI failed for question ${questionId}:`, error.message);
                    
                    if (this.fallbackToLocal && this.geminiClient) {
                        console.log(`🔄 Falling back to local Gemini AI for question ${questionId}`);
                        return await this.processWithGemini(questionId, startTime);
                    } else {
                        throw error;
                    }
                }
            } else {
                // Use original Gemini service
                return await this.processWithGemini(questionId, startTime);
            }
        } catch (error) {
            console.error(`❌ Failed to process question ${questionId}:`, error.message);
            
            // Only update database with error if no answer exists yet
            const processingTime = Date.now() - startTime;
            try {
                // Check if record already has an answer
                const existingRecord = await this.db.getQuestion(questionId);
                if (!existingRecord || !existingRecord.answer) {
                    const errorMessage = `Error: ${error.message || 'Unknown error during AI processing'}`;
                    console.log(`💾 Updating database with error for question ${questionId}: ${errorMessage}`);
                    await this.updateAnswer(questionId, errorMessage, 'error', processingTime, false, []);
                } else {
                    console.log(`ℹ️ Question ${questionId} already has an answer, not overwriting with error`);
                }
            } catch (dbError) {
                console.error(`❌ Failed to update database with error for question ${questionId}:`, dbError.message);
            }
            
            throw error;
        }
    }

    async processWithGemini(questionId, startTime) {
        if (!this.geminiClient) {
            throw new Error('Gemini client not available');
        }

        // Get the question from database
        const record = await this.db.getQuestion(questionId);
        if (!record) {
            throw new Error(`Question with ID ${questionId} not found`);
        }

        if (record.answer) {
            console.log(`ℹ️ Question ${questionId} already has an answer, skipping`);
            return { success: true, answer: record.answer, source: 'existing' };
        }

        // Generate answer using Gemini
        const answer = await this.geminiClient.generateAnswer(record.question);
        const processingTime = Date.now() - startTime;

        // Update database with Gemini result
        await this.updateAnswer(questionId, answer, 'gemini', processingTime, false, []);

        console.log(`✅ Gemini successfully processed question ${questionId}`);
        return { success: true, answer, source: 'gemini' };
    }

    async updateAnswer(questionId, answer, processingMethod, processingTime, usedRag, ragSources) {
        try {
            // Check if the database has the enhanced columns
            const hasEnhancedColumns = await this.checkEnhancedColumns();
            
            if (hasEnhancedColumns) {
                await this.db.query(
                    `UPDATE questions_answers SET 
                     answer = $2, 
                     processed_by = $3, 
                     processing_time = $4, 
                     used_rag = $5, 
                     rag_sources = $6,
                     updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $1`,
                    [questionId, answer, processingMethod, processingTime, usedRag, ragSources]
                );
            } else {
                // Fallback to basic update
                await this.db.updateAnswer(questionId, answer);
            }
        } catch (error) {
            console.error(`❌ Error updating answer for question ${questionId}:`, error.message);
            throw error;
        }
    }

    async checkEnhancedColumns() {
        try {
            const result = await this.db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'questions_answers' 
                AND column_name IN ('processed_by', 'processing_time', 'used_rag', 'rag_sources')
            `);
            return result.rows.length === 4;
        } catch (error) {
            console.warn('⚠️ Could not check for enhanced columns:', error.message);
            return false;
        }
    }

    async getSystemStatus() {
        const status = {
            timestamp: new Date().toISOString(),
            service: 'hybrid-ai-service',
            enhanced: {
                enabled: this.useEnhanced,
                healthy: false,
                status: null
            },
            gemini: {
                available: !!this.geminiClient,
                healthy: false,
                fallback: this.fallbackToLocal
            }
        };

        // Check enhanced service
        if (this.useEnhanced && this.enhancedClient) {
            try {
                status.enhanced.healthy = await this.enhancedClient.healthCheck();
                if (status.enhanced.healthy) {
                    status.enhanced.status = await this.enhancedClient.getStatus();
                }
            } catch (error) {
                console.error('❌ Error checking enhanced AI status:', error.message);
            }
        }

        // Check Gemini service
        if (this.geminiClient) {
            try {
                status.gemini.healthy = await this.geminiClient.test();
            } catch (error) {
                console.error('❌ Error checking Gemini AI status:', error.message);
            }
        }

        return status;
    }

    async test() {
        console.log('🧪 Testing Hybrid AI Service...');
        
        const status = await this.getSystemStatus();
        
        console.log('📊 System Status:');
        console.log(`  Enhanced AI: ${status.enhanced.enabled ? 'enabled' : 'disabled'} (${status.enhanced.healthy ? 'healthy' : 'unhealthy'})`);
        console.log(`  Gemini AI: ${status.gemini.available ? 'available' : 'unavailable'} (${status.gemini.healthy ? 'healthy' : 'unhealthy'})`);
        
        if (this.useEnhanced && status.enhanced.healthy) {
            console.log('✅ Enhanced AI service is ready');
        } else if (status.gemini.available && status.gemini.healthy) {
            console.log('✅ Gemini AI service is ready');
        } else {
            console.log('⚠️ No AI services are available');
        }
        
        return status;
    }
}

module.exports = HybridAIService; 