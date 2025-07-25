const { Pool } = require('pg');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        const config = {
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'clipboard_tts',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true',
            max: 20, // maximum number of clients in the pool
            idleTimeoutMillis: 30000, // how long a client is allowed to remain idle
            connectionTimeoutMillis: 2000, // how long to try connecting
        };

        try {
            this.pool = new Pool(config);
            
            // Test the connection
            const client = await this.pool.connect();
            client.release();
            
            this.isConnected = true;
            console.log('✅ Connected to PostgreSQL database (pool)');
            
            // Handle pool errors
            this.pool.on('error', (err) => {
                console.error('❌ Unexpected error on idle client:', err);
            });

            return true;
        } catch (error) {
            console.error('❌ Failed to connect to database:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    async query(text, params) {
        if (!this.isConnected || !this.pool) {
            throw new Error('Database not connected');
        }

        try {
            const result = await this.pool.query(text, params);
            return result;
        } catch (error) {
            console.error('❌ Database query error:', error);
            throw error;
        }
    }

    async getAllRecords() {
        const result = await this.query(
            'SELECT id, question, answer, mp3path, created_at, updated_at FROM questions_answers ORDER BY created_at DESC'
        );
        return result.rows;
    }

    async getRecordIds() {
        const result = await this.query(
            'SELECT id FROM questions_answers ORDER BY created_at DESC'
        );
        return result.rows.map(row => row.id);
    }

    async getRecord(id) {
        const result = await this.query(
            'SELECT id, question, answer, mp3path, created_at, updated_at FROM questions_answers WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    async deleteRecord(id) {
        const result = await this.query(
            'DELETE FROM questions_answers WHERE id = $1 RETURNING mp3path',
            [id]
        );
        return result.rows[0];
    }

    async insertQuestion(question) {
        const result = await this.query(
            'INSERT INTO questions_answers (question) VALUES ($1) RETURNING id',
            [question]
        );
        return result.rows[0].id;
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🔌 Database pool closed');
        }
    }

    // Health check method
    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return { status: 'healthy', connected: true };
        } catch (error) {
            return { status: 'unhealthy', connected: false, error: error.message };
        }
    }
}

module.exports = DatabaseManager; 