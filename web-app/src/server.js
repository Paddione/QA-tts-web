require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs').promises;

const DatabaseManager = require('./database');

class WebServer {
    constructor() {
        this.app = express();
        this.db = new DatabaseManager();
        this.port = process.env.PORT || 3000;
        this.mp3Dir = path.join(__dirname, '../public/mp3');
    }

    async start() {
        console.log('🚀 Starting Web Server...');

        // Connect to database
        const connected = await this.db.connect();
        if (!connected) {
            console.error('❌ Failed to connect to database');
            process.exit(1);
        }

        // Setup middleware
        this.setupMiddleware();

        // Setup routes
        this.setupRoutes();

        // Start server
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`✅ Web server running on port ${this.port}`);
            console.log(`🌐 Access the app at http://localhost:${this.port}`);
        });
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    mediaSrc: ["'self'"]
                }
            }
        }));

        // Enable CORS
        this.app.use(cors());

        // Compression
        this.app.use(compression());

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Static files
        this.app.use('/mp3', express.static(path.join(__dirname, '../public/mp3')));
        this.app.use('/css', express.static(path.join(__dirname, '../public/css')));
        this.app.use('/js', express.static(path.join(__dirname, '../public/js')));

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const dbHealth = await this.db.healthCheck();
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

        // API Routes
        
        // AI service status endpoint
        this.app.get('/api/ai-status', async (req, res) => {
            try {
                // This would need to connect to the AI service to get real status
                // For now, return a placeholder that can be extended
                const status = {
                    timestamp: new Date().toISOString(),
                    services: {
                        enhanced: {
                            enabled: process.env.USE_ENHANCED_AI === 'true',
                            url: process.env.ENHANCED_AI_SERVICE_URL || 'http://10.1.0.26:3001',
                            healthy: false // This would be checked via actual health check
                        },
                        gemini: {
                            available: !!process.env.GEMINI_API_KEY,
                            fallback: process.env.FALLBACK_TO_LOCAL_AI === 'true'
                        }
                    },
                    network: {
                        wsl_host: process.env.WSL_HOST || '10.1.0.26',
                        remote_client: process.env.REMOTE_CLIENT_HOST || '10.0.0.44'
                    }
                };
                
                res.json({ success: true, data: status });
            } catch (error) {
                console.error('❌ Error getting AI status:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to get AI service status' 
                });
            }
        });
        
        // Get all record IDs
        this.app.get('/api/records', async (req, res) => {
            try {
                const ids = await this.db.getRecordIds();
                res.json({ success: true, data: ids });
            } catch (error) {
                console.error('❌ Error fetching record IDs:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to fetch records' 
                });
            }
        });

        // Get specific record
        this.app.get('/api/records/:id', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Invalid record ID' 
                    });
                }

                const record = await this.db.getRecord(id);
                if (!record) {
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Record not found' 
                    });
                }

                res.json({ success: true, data: record });
            } catch (error) {
                console.error(`❌ Error fetching record ${req.params.id}:`, error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to fetch record' 
                });
            }
        });

        // Delete record
        this.app.delete('/api/records/:id', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Invalid record ID' 
                    });
                }

                // Delete the record and get the mp3path
                const deletedRecord = await this.db.deleteRecord(id);
                if (!deletedRecord) {
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Record not found' 
                    });
                }

                // Delete associated MP3 file if it exists
                if (deletedRecord.mp3path && !deletedRecord.mp3path.startsWith('ERROR:')) {
                    try {
                        const mp3FilePath = path.join(this.mp3Dir, `${id}.mp3`);
                        await fs.unlink(mp3FilePath);
                        console.log(`🗑️ Deleted MP3 file: ${id}.mp3`);
                    } catch (fileError) {
                        console.warn(`⚠️ Failed to delete MP3 file for record ${id}:`, fileError.message);
                    }
                }

                res.json({ 
                    success: true, 
                    message: `Record ${id} deleted successfully` 
                });
            } catch (error) {
                console.error(`❌ Error deleting record ${req.params.id}:`, error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to delete record' 
                });
            }
        });

        // Create new question (for testing)
        this.app.post('/api/records', async (req, res) => {
            try {
                const { question } = req.body;
                if (!question || question.trim().length === 0) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Question text is required' 
                    });
                }

                const id = await this.db.insertQuestion(question.trim());
                res.json({ 
                    success: true, 
                    data: { id, question: question.trim() },
                    message: 'Question created successfully' 
                });
            } catch (error) {
                console.error('❌ Error creating question:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to create question' 
                });
            }
        });

        // Serve main HTML page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ 
                success: false, 
                error: 'Endpoint not found' 
            });
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('💥 Unhandled error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Internal server error' 
            });
        });
    }

    async stop() {
        console.log('🛑 Stopping Web Server...');
        await this.db.close();
        console.log('✅ Web Server stopped');
    }
}

// Handle graceful shutdown
const webServer = new WebServer();

process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await webServer.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await webServer.stop();
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

// Start the server
webServer.start().catch((error) => {
    console.error('💥 Failed to start web server:', error);
    process.exit(1);
}); 