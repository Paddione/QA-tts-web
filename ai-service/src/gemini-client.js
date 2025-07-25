const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiClient {
    constructor(apiKey, gemId) {
        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }
        
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.gemId = gemId || "gemini-2.5-flash"; // Updated default model
        this.retryDelay = 1000; // Start with 1 second
        this.maxRetryDelay = 30000; // Max 30 seconds
        this.maxRetries = 5;
        
        console.log(`🤖 Gemini client configured:`);
        console.log(`   Model: ${this.gemId}`);
        console.log(`   API Key: ${apiKey ? '***' + apiKey.slice(-4) : 'Not provided'}`);
        console.log(`   Authentication: API Key`);
    }

    async generateAnswer(question, retryCount = 0) {
        try {
            console.log(`🤖 Processing question with Gemini model ${this.gemId}: "${question.substring(0, 100)}..."`);
            
            // Get the generative model with enhanced configuration
            const modelConfig = {
                model: this.gemId,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE",
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE",
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE",
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE",
                    },
                ],
            };
            
            const model = this.genAI.getGenerativeModel(modelConfig);

            // Create a more detailed prompt for better responses
            const prompt = `Please provide a helpful, accurate, and concise answer to the following question. 
            If the question is unclear or incomplete, provide the best possible interpretation and answer.
            
            Question: ${question}
            
            Answer:`;

            // Generate content with the latest API
            const result = await model.generateContent(prompt);
            const response = result.response;
            const answer = response.text();

            if (!answer || answer.trim().length === 0) {
                throw new Error('Empty response from Gemini API');
            }

            console.log(`✅ Generated answer with model ${this.gemId} (${answer.length} characters)`);
            return answer.trim();

        } catch (error) {
            console.error(`❌ Gemini API error with model ${this.gemId} (attempt ${retryCount + 1}):`, error.message);

            // Check if we should retry
            if (retryCount < this.maxRetries && this.shouldRetry(error)) {
                const delay = Math.min(this.retryDelay * Math.pow(2, retryCount), this.maxRetryDelay);
                console.log(`🔄 Retrying in ${delay / 1000} seconds...`);
                
                await this.sleep(delay);
                return this.generateAnswer(question, retryCount + 1);
            }

            // If we've exhausted retries or shouldn't retry, throw the error
            throw new Error(`Failed to generate answer with model ${this.gemId} after ${retryCount + 1} attempts: ${error.message}`);
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
            'RATE_LIMIT_EXCEEDED',
            'QUOTA_EXCEEDED',
            'Internal error',
            'SERVICE_UNAVAILABLE',
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

    // Test method to verify API connectivity with the configured model
    async test() {
        try {
            const testAnswer = await this.generateAnswer("What is 2+2? Please answer briefly.");
            console.log(`🧪 Gemini API test successful with model ${this.gemId}: ${testAnswer}`);
            return true;
        } catch (error) {
            console.error(`🧪 Gemini API test failed with model ${this.gemId}:`, error.message);
            return false;
        }
    }

    // Method to list available models (for debugging)
    async listModels() {
        try {
            const models = await this.genAI.listModels();
            console.log('📋 Available Gemini models:');
            models.forEach(model => {
                console.log(`  - ${model.name} (${model.displayName})`);
            });
            return models;
        } catch (error) {
            console.error('❌ Failed to list models:', error.message);
            return [];
        }
    }
}

module.exports = GeminiClient; 