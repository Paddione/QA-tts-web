const request = require('supertest');
const express = require('express');
const path = require('path');

// Create a test app instance
function createTestApp() {
    const app = express();
    app.use(express.json());
    
    // Mock database
    const mockDb = {
        isConnected: true,
        healthCheck: jest.fn(),
        getRecordIds: jest.fn(),
        getRecord: jest.fn(),
        deleteRecord: jest.fn(),
        insertQuestion: jest.fn(),
    };
    
    // Health endpoint
    app.get('/health', async (req, res) => {
        try {
            const dbHealth = await mockDb.healthCheck();
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: dbHealth
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    });
    
    // API endpoints
    app.get('/api/records', async (req, res) => {
        try {
            const ids = await mockDb.getRecordIds();
            res.json({ success: true, data: ids });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch records' 
            });
        }
    });
    
    app.get('/api/records/:id', async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid record ID' 
                });
            }
            
            const record = await mockDb.getRecord(id);
            if (!record) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Record not found' 
                });
            }
            
            res.json({ success: true, data: record });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch record' 
            });
        }
    });
    
    app.delete('/api/records/:id', async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid record ID' 
                });
            }
            
            const deletedRecord = await mockDb.deleteRecord(id);
            if (!deletedRecord) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Record not found' 
                });
            }
            
            res.json({ 
                success: true, 
                message: `Record ${id} deleted successfully` 
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to delete record' 
            });
        }
    });
    
    app.post('/api/records', async (req, res) => {
        try {
            const { question } = req.body;
            if (!question || question.trim().length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Question text is required' 
                });
            }
            
            const id = await mockDb.insertQuestion(question.trim());
            res.json({ 
                success: true, 
                data: { id, question: question.trim() },
                message: 'Question created successfully' 
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to create question' 
            });
        }
    });
    
    return { app, mockDb };
}

describe('API Integration Tests', () => {
    let app;
    let mockDb;
    
    beforeEach(() => {
        const testApp = createTestApp();
        app = testApp.app;
        mockDb = testApp.mockDb;
        jest.clearAllMocks();
    });
    
    describe('GET /health', () => {
        it('should return healthy status', async () => {
            mockDb.healthCheck.mockResolvedValue({
                status: 'healthy',
                connected: true
            });
            
            const response = await request(app).get('/health');
            
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ok');
            expect(response.body.database.status).toBe('healthy');
        });
        
        it('should return error status when database fails', async () => {
            mockDb.healthCheck.mockRejectedValue(new Error('Database unavailable'));
            
            const response = await request(app).get('/health');
            
            expect(response.status).toBe(500);
            expect(response.body.status).toBe('error');
        });
    });
    
    describe('GET /api/records', () => {
        it('should return list of record IDs', async () => {
            mockDb.getRecordIds.mockResolvedValue([1, 2, 3, 4, 5]);
            
            const response = await request(app).get('/api/records');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                data: [1, 2, 3, 4, 5]
            });
        });
        
        it('should handle database errors', async () => {
            mockDb.getRecordIds.mockRejectedValue(new Error('Database error'));
            
            const response = await request(app).get('/api/records');
            
            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });
    });
    
    describe('GET /api/records/:id', () => {
        it('should return specific record', async () => {
            const mockRecord = {
                id: 1,
                question: 'What is the capital of France?',
                answer: 'The capital of France is Paris.',
                mp3path: '/mp3/1.mp3',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            mockDb.getRecord.mockResolvedValue(mockRecord);
            
            const response = await request(app).get('/api/records/1');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockRecord);
        });
        
        it('should return 404 for non-existent record', async () => {
            mockDb.getRecord.mockResolvedValue(null);
            
            const response = await request(app).get('/api/records/999');
            
            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Record not found');
        });
        
        it('should return 400 for invalid ID', async () => {
            const response = await request(app).get('/api/records/invalid');
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid record ID');
        });
    });
    
    describe('DELETE /api/records/:id', () => {
        it('should delete record successfully', async () => {
            mockDb.deleteRecord.mockResolvedValue({ mp3path: '/mp3/1.mp3' });
            
            const response = await request(app).delete('/api/records/1');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Record 1 deleted successfully');
        });
        
        it('should return 404 for non-existent record', async () => {
            mockDb.deleteRecord.mockResolvedValue(null);
            
            const response = await request(app).delete('/api/records/999');
            
            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
        
        it('should return 400 for invalid ID', async () => {
            const response = await request(app).delete('/api/records/invalid');
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });
    
    describe('POST /api/records', () => {
        it('should create new question successfully', async () => {
            mockDb.insertQuestion.mockResolvedValue(5);
            
            const response = await request(app)
                .post('/api/records')
                .send({ question: 'What is quantum computing?' });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(5);
            expect(response.body.data.question).toBe('What is quantum computing?');
        });
        
        it('should return 400 for empty question', async () => {
            const response = await request(app)
                .post('/api/records')
                .send({ question: '' });
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Question text is required');
        });
        
        it('should return 400 for missing question', async () => {
            const response = await request(app)
                .post('/api/records')
                .send({});
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
        
        it('should handle database errors', async () => {
            mockDb.insertQuestion.mockRejectedValue(new Error('Database error'));
            
            const response = await request(app)
                .post('/api/records')
                .send({ question: 'Test question' });
            
            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });
    });
}); 