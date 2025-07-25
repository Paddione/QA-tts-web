/**
 * Jest setup file for Clipboard-to-TTS system tests
 */

// Increase test timeout for integration and e2e tests
jest.setTimeout(30000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_clipboard_tts';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.GEMINI_API_KEY = 'test_gemini_key';
process.env.GEM_ID = 'gemini-pro';
process.env.GOOGLE_TTS_KEY = 'test_tts_key';

// Global test utilities
global.testUtils = {
    createMockRecord: (id = 1, options = {}) => ({
        id,
        question: options.question || 'Test question?',
        answer: options.answer || 'Test answer.',
        mp3path: options.mp3path || `/mp3/${id}.mp3`,
        created_at: options.created_at || new Date().toISOString(),
        updated_at: options.updated_at || new Date().toISOString(),
        ...options
    }),
    
    createMockError: (message = 'Test error', code = 'TEST_ERROR') => {
        const error = new Error(message);
        error.code = code;
        return error;
    },
    
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    mockConsole: () => {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
        
        return {
            restore: () => {
                console.log = originalLog;
                console.error = originalError;
                console.warn = originalWarn;
            },
            logs: console.log,
            errors: console.error,
            warnings: console.warn
        };
    }
};

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in test environment
});

console.log('🧪 Test environment initialized'); 