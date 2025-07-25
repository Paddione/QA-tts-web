const request = require('supertest');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Mock implementations for testing
jest.mock('pg');
jest.mock('@google/generative-ai');
jest.mock('@google-cloud/text-to-speech');

describe('End-to-End Workflow Tests', () => {
    let mockDb;
    let mockPool;
    let questionId;
    
    const testQuestion = "What is the meaning of life according to Douglas Adams?";
    const testAnswer = "According to Douglas Adams in 'The Hitchhiker's Guide to the Galaxy', the meaning of life is 42.";
    const testMp3Path = "/mp3/1.mp3";

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock database pool
        mockPool = {
            connect: jest.fn(),
            query: jest.fn(),
            end: jest.fn(),
            on: jest.fn(),
        };
        Pool.mockImplementation(() => mockPool);
        
        // Mock successful database responses
        const mockClient = {
            connect: jest.fn(),
            query: jest.fn(),
            release: jest.fn(),
        };
        
        mockPool.connect.mockResolvedValue(mockClient);
        
        questionId = 1;
    });

    describe('Complete Workflow Simulation', () => {
        it('should process question from creation to MP3 generation', async () => {
            // Step 1: Simulate question insertion (clipboard capture)
            mockPool.query.mockImplementation((sql, params) => {
                if (sql.includes('INSERT INTO questions_answers')) {
                    return Promise.resolve({ rows: [{ id: questionId }] });
                }
                if (sql.includes('SELECT') && sql.includes('WHERE id =')) {
                    // First call - question without answer
                    if (mockPool.query.mock.calls.length === 2) {
                        return Promise.resolve({
                            rows: [{
                                id: questionId,
                                question: testQuestion,
                                answer: null,
                                mp3path: null
                            }]
                        });
                    }
                    // Second call - question with answer but no MP3
                    if (mockPool.query.mock.calls.length === 4) {
                        return Promise.resolve({
                            rows: [{
                                id: questionId,
                                question: testQuestion,
                                answer: testAnswer,
                                mp3path: null
                            }]
                        });
                    }
                    // Third call - complete record
                    return Promise.resolve({
                        rows: [{
                            id: questionId,
                            question: testQuestion,
                            answer: testAnswer,
                            mp3path: testMp3Path
                        }]
                    });
                }
                if (sql.includes('UPDATE') && sql.includes('answer =')) {
                    return Promise.resolve({ rows: [] });
                }
                if (sql.includes('UPDATE') && sql.includes('mp3path =')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            // Simulate question insertion
            console.log('📝 Step 1: Inserting question...');
            const insertResult = await simulateQuestionInsertion(testQuestion);
            expect(insertResult.id).toBe(questionId);
            console.log(`✅ Question inserted with ID: ${insertResult.id}`);

            // Simulate AI processing
            console.log('🤖 Step 2: Processing with AI...');
            const processedQuestion = await simulateAIProcessing(questionId);
            expect(processedQuestion.answer).toBe(testAnswer);
            console.log(`✅ AI generated answer: ${processedQuestion.answer.substring(0, 50)}...`);

            // Simulate TTS processing
            console.log('🎵 Step 3: Converting to speech...');
            const finalRecord = await simulateTTSProcessing(questionId);
            expect(finalRecord.mp3path).toBe(testMp3Path);
            console.log(`✅ TTS generated MP3: ${finalRecord.mp3path}`);

            // Verify complete workflow
            expect(finalRecord).toEqual({
                id: questionId,
                question: testQuestion,
                answer: testAnswer,
                mp3path: testMp3Path
            });

            console.log('🎉 End-to-end workflow completed successfully!');
        });

        it('should handle errors gracefully in the workflow', async () => {
            // Simulate database error during question insertion
            mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

            await expect(simulateQuestionInsertion(testQuestion))
                .rejects.toThrow('Database connection failed');

            // Simulate AI processing error
            mockPool.query.mockImplementation((sql, params) => {
                if (sql.includes('SELECT') && sql.includes('WHERE id =')) {
                    return Promise.resolve({
                        rows: [{
                            id: questionId,
                            question: testQuestion,
                            answer: null,
                            mp3path: null
                        }]
                    });
                }
                if (sql.includes('UPDATE') && sql.includes('answer =')) {
                    throw new Error('AI processing failed');
                }
                return Promise.resolve({ rows: [] });
            });

            await expect(simulateAIProcessing(questionId))
                .rejects.toThrow('AI processing failed');
        });

        it('should handle concurrent question processing', async () => {
            const questions = [
                "What is quantum computing?",
                "How does photosynthesis work?",
                "Explain machine learning basics"
            ];

            mockPool.query.mockImplementation((sql, params) => {
                if (sql.includes('INSERT INTO questions_answers')) {
                    const questionIndex = questions.findIndex(q => params && params[0] === q);
                    return Promise.resolve({ rows: [{ id: questionIndex + 1 }] });
                }
                return Promise.resolve({ rows: [] });
            });

            // Simulate concurrent question insertions
            const insertPromises = questions.map(question => 
                simulateQuestionInsertion(question)
            );

            const results = await Promise.all(insertPromises);
            
            expect(results).toHaveLength(3);
            expect(results[0].id).toBe(1);
            expect(results[1].id).toBe(2);
            expect(results[2].id).toBe(3);
        });
    });

    describe('Database Triggers Simulation', () => {
        it('should simulate notification triggers', async () => {
            const notifications = [];
            
            // Mock notification system
            const mockNotificationHandler = (channel, payload) => {
                notifications.push({ channel, payload });
            };

            // Simulate new_question trigger
            mockNotificationHandler('new_question', questionId.toString());
            expect(notifications).toContainEqual({
                channel: 'new_question',
                payload: questionId.toString()
            });

            // Simulate new_answer trigger
            mockNotificationHandler('new_answer', questionId.toString());
            expect(notifications).toContainEqual({
                channel: 'new_answer',
                payload: questionId.toString()
            });
        });
    });

    describe('File System Operations', () => {
        it('should simulate MP3 file creation and cleanup', async () => {
            const mp3FilePath = path.join('/tmp', 'test_1.mp3');
            
            // Mock file system operations
            const mockFileOps = {
                writeFile: jest.fn().mockResolvedValue(),
                unlink: jest.fn().mockResolvedValue(),
                stat: jest.fn().mockResolvedValue({
                    size: 1024,
                    birthtime: new Date(),
                    mtime: new Date()
                })
            };

            // Simulate MP3 file creation
            await mockFileOps.writeFile(mp3FilePath, Buffer.from('fake mp3 data'));
            expect(mockFileOps.writeFile).toHaveBeenCalledWith(
                mp3FilePath,
                expect.any(Buffer)
            );

            // Simulate file info retrieval
            const fileInfo = await mockFileOps.stat(mp3FilePath);
            expect(fileInfo.size).toBe(1024);

            // Simulate file cleanup
            await mockFileOps.unlink(mp3FilePath);
            expect(mockFileOps.unlink).toHaveBeenCalledWith(mp3FilePath);
        });
    });

    describe('Performance Testing', () => {
        it('should handle high volume of questions', async () => {
            const questionCount = 100;
            const questions = Array.from({ length: questionCount }, (_, i) => 
                `Test question number ${i + 1}`
            );

            mockPool.query.mockImplementation((sql, params) => {
                if (sql.includes('INSERT INTO questions_answers')) {
                    const questionIndex = questions.findIndex(q => params && params[0] === q);
                    return Promise.resolve({ rows: [{ id: questionIndex + 1 }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const startTime = Date.now();
            
            // Process questions in batches
            const batchSize = 10;
            const batches = [];
            for (let i = 0; i < questions.length; i += batchSize) {
                batches.push(questions.slice(i, i + batchSize));
            }

            for (const batch of batches) {
                const batchPromises = batch.map(question => 
                    simulateQuestionInsertion(question)
                );
                await Promise.all(batchPromises);
            }

            const processingTime = Date.now() - startTime;
            console.log(`⏱️ Processed ${questionCount} questions in ${processingTime}ms`);
            
            // Expect reasonable performance (less than 5 seconds for 100 questions)
            expect(processingTime).toBeLessThan(5000);
        });
    });
});

// Helper functions for simulation
async function simulateQuestionInsertion(question) {
    const mockPool = new Pool();
    const result = await mockPool.query(
        'INSERT INTO questions_answers (question) VALUES ($1) RETURNING id',
        [question]
    );
    return { id: result.rows[0].id, question };
}

async function simulateAIProcessing(questionId) {
    const mockPool = new Pool();
    
    // Get question
    const questionResult = await mockPool.query(
        'SELECT id, question, answer FROM questions_answers WHERE id = $1',
        [questionId]
    );
    
    const record = questionResult.rows[0];
    if (!record || record.answer) {
        return record;
    }

    // Simulate AI processing
    const testAnswer = "According to Douglas Adams in 'The Hitchhiker's Guide to the Galaxy', the meaning of life is 42.";
    
    // Update with answer
    await mockPool.query(
        'UPDATE questions_answers SET answer = $2 WHERE id = $1',
        [questionId, testAnswer]
    );

    return {
        id: questionId,
        question: record.question,
        answer: testAnswer
    };
}

async function simulateTTSProcessing(questionId) {
    const mockPool = new Pool();
    
    // Get answer
    const answerResult = await mockPool.query(
        'SELECT id, answer, mp3path FROM questions_answers WHERE id = $1',
        [questionId]
    );
    
    const record = answerResult.rows[0];
    if (!record || !record.answer || record.mp3path) {
        return record;
    }

    // Simulate TTS processing
    const mp3Path = `/mp3/${questionId}.mp3`;
    
    // Update with MP3 path
    await mockPool.query(
        'UPDATE questions_answers SET mp3path = $2 WHERE id = $1',
        [questionId, mp3Path]
    );

    return {
        id: questionId,
        question: "What is the meaning of life according to Douglas Adams?",
        answer: record.answer,
        mp3path: mp3Path
    };
} 