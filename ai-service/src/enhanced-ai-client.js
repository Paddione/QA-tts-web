const fetch = require('node-fetch');

class EnhancedAIClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || process.env.ENHANCED_AI_SERVICE_URL || 'http://10.1.0.26:3001';
        this.timeout = parseInt(process.env.LOCAL_AI_TIMEOUT) || 30000; // 30 seconds
        this.maxRetries = 2;
        
        console.log(`🔗 Enhanced AI Client configured: ${this.baseUrl}`);
    }

    async processQuestion(questionId) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`🚀 Enhanced AI processing question ${questionId} (attempt ${attempt}/${this.maxRetries})`);
                
                const response = await fetch(`${this.baseUrl}/process/${questionId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`✅ Enhanced AI successfully processed question ${questionId}`);
                return result;

            } catch (error) {
                console.error(`❌ Enhanced AI attempt ${attempt} failed for question ${questionId}:`, error.message);
                
                if (attempt === this.maxRetries) {
                    throw error;
                }
                
                await this.sleep(1000 * attempt);
            }
        }
    }

    async resetRecord(questionId) {
        try {
            console.log(`🔄 Resetting record ${questionId} on enhanced AI service`);
            
            const response = await fetch(`${this.baseUrl}/records/${questionId}/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`✅ Successfully reset record ${questionId}`);
            return result;
        } catch (error) {
            console.error(`❌ Error resetting record ${questionId}:`, error.message);
            throw error;
        }
    }

    async getStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/status`, {
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Error getting enhanced AI status:', error.message);
            throw error;
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            console.warn(`⚠️ Enhanced AI health check failed: ${error.message}`);
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Test method to verify enhanced AI connectivity
    async test() {
        try {
            console.log(`🧪 Testing enhanced AI service connectivity to ${this.baseUrl}`);
            const healthy = await this.healthCheck();
            
            if (healthy) {
                const status = await this.getStatus();
                console.log(`🧪 Enhanced AI test successful:`, status);
                return true;
            } else {
                console.log(`🧪 Enhanced AI health check failed`);
                return false;
            }
        } catch (error) {
            console.error(`🧪 Enhanced AI test failed:`, error.message);
            return false;
        }
    }
}

module.exports = EnhancedAIClient; 