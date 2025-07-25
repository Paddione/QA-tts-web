const { Pool } = require('pg');
const DatabaseManager = require('../../web-app/src/database');

// Mock pg Pool
jest.mock('pg');

describe('DatabaseManager', () => {
    let dbManager;
    let mockPool;
    let mockClient;

    beforeEach(() => {
        mockClient = {
            connect: jest.fn(),
            query: jest.fn(),
            release: jest.fn(),
        };
        
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            query: jest.fn(),
            end: jest.fn(),
            on: jest.fn(),
        };
        
        Pool.mockImplementation(() => mockPool);
        
        dbManager = new DatabaseManager();
        
        // Mock environment variables
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test_db';
        process.env.DB_USER = 'test_user';
        process.env.DB_PASSWORD = 'test_password';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('connect', () => {
        it('should connect successfully', async () => {
            const result = await dbManager.connect();
            
            expect(result).toBe(true);
            expect(mockPool.connect).toHaveBeenCalled();
            expect(mockClient.release).toHaveBeenCalled();
            expect(dbManager.isConnected).toBe(true);
        });

        it('should handle connection errors', async () => {
            mockPool.connect.mockRejectedValue(new Error('Connection failed'));
            
            const result = await dbManager.connect();
            
            expect(result).toBe(false);
            expect(dbManager.isConnected).toBe(false);
        });
    });

    describe('query', () => {
        beforeEach(async () => {
            await dbManager.connect();
        });

        it('should execute queries successfully', async () => {
            const mockResult = { rows: [{ id: 1 }] };
            mockPool.query.mockResolvedValue(mockResult);
            
            const result = await dbManager.query('SELECT * FROM test', []);
            
            expect(result).toEqual(mockResult);
            expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test', []);
        });

        it('should throw error when not connected', async () => {
            dbManager.isConnected = false;
            
            await expect(dbManager.query('SELECT 1')).rejects.toThrow('Database not connected');
        });
    });

    describe('getRecordIds', () => {
        beforeEach(async () => {
            await dbManager.connect();
        });

        it('should return list of record IDs', async () => {
            const mockResult = { 
                rows: [{ id: 1 }, { id: 2 }, { id: 3 }] 
            };
            mockPool.query.mockResolvedValue(mockResult);
            
            const ids = await dbManager.getRecordIds();
            
            expect(ids).toEqual([1, 2, 3]);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT id FROM questions_answers ORDER BY created_at DESC',
                undefined
            );
        });
    });

    describe('getRecord', () => {
        beforeEach(async () => {
            await dbManager.connect();
        });

        it('should return a specific record', async () => {
            const mockRecord = {
                id: 1,
                question: 'Test question',
                answer: 'Test answer',
                mp3path: '/mp3/1.mp3',
                created_at: new Date(),
                updated_at: new Date()
            };
            const mockResult = { rows: [mockRecord] };
            mockPool.query.mockResolvedValue(mockResult);
            
            const record = await dbManager.getRecord(1);
            
            expect(record).toEqual(mockRecord);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT id, question, answer, mp3path, created_at, updated_at FROM questions_answers WHERE id = $1',
                [1]
            );
        });
    });

    describe('insertQuestion', () => {
        beforeEach(async () => {
            await dbManager.connect();
        });

        it('should insert a new question and return ID', async () => {
            const mockResult = { rows: [{ id: 5 }] };
            mockPool.query.mockResolvedValue(mockResult);
            
            const id = await dbManager.insertQuestion('New question');
            
            expect(id).toBe(5);
            expect(mockPool.query).toHaveBeenCalledWith(
                'INSERT INTO questions_answers (question) VALUES ($1) RETURNING id',
                ['New question']
            );
        });
    });

    describe('deleteRecord', () => {
        beforeEach(async () => {
            await dbManager.connect();
        });

        it('should delete a record and return mp3path', async () => {
            const mockResult = { rows: [{ mp3path: '/mp3/1.mp3' }] };
            mockPool.query.mockResolvedValue(mockResult);
            
            const deletedRecord = await dbManager.deleteRecord(1);
            
            expect(deletedRecord).toEqual({ mp3path: '/mp3/1.mp3' });
            expect(mockPool.query).toHaveBeenCalledWith(
                'DELETE FROM questions_answers WHERE id = $1 RETURNING mp3path',
                [1]
            );
        });
    });

    describe('healthCheck', () => {
        beforeEach(async () => {
            await dbManager.connect();
        });

        it('should return healthy status', async () => {
            mockPool.query.mockResolvedValue({ rows: [] });
            
            const health = await dbManager.healthCheck();
            
            expect(health).toEqual({
                status: 'healthy',
                connected: true
            });
        });

        it('should return unhealthy status on error', async () => {
            mockPool.query.mockRejectedValue(new Error('Query failed'));
            
            const health = await dbManager.healthCheck();
            
            expect(health.status).toBe('unhealthy');
            expect(health.connected).toBe(false);
            expect(health.error).toBe('Query failed');
        });
    });
}); 