const { Client } = require('pg');

class DatabaseManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
    }

    async connect() {
        const config = {
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'clipboard_tts',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true'
        };

        try {
            this.client = new Client(config);
            await this.client.connect();
            this.isConnected = true;
            this.reconnectDelay = 1000; // Reset delay on successful connection
            
            console.log('✅ Connected to PostgreSQL database');
            
            // Set up connection error handling
            this.client.on('error', (err) => {
                console.error('❌ Database connection error:', err);
                this.isConnected = false;
                this.scheduleReconnect();
            });

            this.client.on('end', () => {
                console.log('🔌 Database connection ended');
                this.isConnected = false;
                this.scheduleReconnect();
            });

            return true;
        } catch (error) {
            console.error('❌ Failed to connect to database:', error.message);
            this.isConnected = false;
            this.scheduleReconnect();
            return false;
        }
    }

    scheduleReconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }

        console.log(`🔄 Attempting to reconnect in ${this.reconnectDelay / 1000} seconds...`);
        
        this.reconnectInterval = setTimeout(async () => {
            await this.connect();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }

    async listen(channel, callback) {
        if (!this.isConnected || !this.client) {
            throw new Error('Database not connected');
        }

        await this.client.query(`LISTEN ${channel}`);
        this.client.on('notification', (msg) => {
            if (msg.channel === channel) {
                callback(msg.payload);
            }
        });

        console.log(`👂 Listening for notifications on channel: ${channel}`);
    }

    async query(text, params) {
        if (!this.isConnected || !this.client) {
            throw new Error('Database not connected');
        }

        try {
            return await this.client.query(text, params);
        } catch (error) {
            console.error('❌ Database query error:', error);
            throw error;
        }
    }

    async getAnswer(id) {
        const result = await this.query(
            'SELECT id, answer, mp3path FROM questions_answers WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    async updateMp3Path(id, mp3path) {
        await this.query(
            'UPDATE questions_answers SET mp3path = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id, mp3path]
        );
    }

    async close() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }
        
        if (this.client && this.isConnected) {
            await this.client.end();
            this.isConnected = false;
            console.log('🔌 Database connection closed');
        }
    }
}

module.exports = DatabaseManager; 