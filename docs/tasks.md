# Remote Client Setup Guide

This document outlines the changes needed on your remote client (10.0.0.44) to integrate with the Local LLM System running on WSL (10.1.0.26).

## Network Architecture Overview

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Remote Client         │     │   WSL Desktop           │
│   10.0.0.44             │◄────┤   10.1.0.26             │
│                         │     │                         │
│ ┌─────────────────────┐ │     │ ┌─────────────────────┐ │
│ │ Web App             │ │     │ │ Ollama              │ │
│ │ TTS Service         │ │     │ │ Chroma Vector DB    │ │
│ │ PostgreSQL          │ │     │ │ n8n Workflows       │ │
│ │ Original AI Service │ │     │ │ Enhanced AI Service │ │
│ └─────────────────────┘ │     │ └─────────────────────┘ │
└─────────────────────────┘     └─────────────────────────┘
```

## Required Changes on Remote Client (10.0.0.44)

### 1. Database Configuration

The PostgreSQL database needs to accept connections from the WSL system.

#### Update `postgresql.conf`
```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/*/main/postgresql.conf

# Add or modify these lines:
listen_addresses = 'localhost,10.0.0.44'
port = 5432
```

#### Update `pg_hba.conf`
```bash
# Edit PostgreSQL host-based authentication
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Add this line to allow connections from WSL:
host    all             all             10.1.0.26/32           md5
```

#### Restart PostgreSQL
```bash
sudo systemctl restart postgresql
```

### 2. Firewall Configuration

Open the necessary ports for communication with WSL.

#### Ubuntu/Debian (ufw)
```bash
# Allow AI Service connections
sudo ufw allow from 10.1.0.26 to any port 5432 comment "PostgreSQL from WSL"

# If you need to access WSL services from remote client:
sudo ufw allow out to 10.1.0.26 port 3001 comment "AI Service on WSL"
sudo ufw allow out to 10.1.0.26 port 11434 comment "Ollama on WSL"
sudo ufw allow out to 10.1.0.26 port 8000 comment "Chroma on WSL"
```

#### CentOS/RHEL (firewalld)
```bash
# Allow PostgreSQL from WSL
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.1.0.26" port protocol="tcp" port="5432" accept'
sudo firewall-cmd --reload
```

### 3. Environment Variables

Update your existing AI service environment to point to the new WSL-based system.

#### Create/Update `.env` file
```bash
# Database Configuration (keep existing)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clipboard
DB_USER=postgres
DB_PASSWORD=your_existing_password

# New AI Service Configuration
ENHANCED_AI_SERVICE_URL=http://10.1.0.26:3001
USE_ENHANCED_AI=true

# Fallback Configuration
FALLBACK_TO_LOCAL_AI=true
LOCAL_AI_TIMEOUT=30000  # 30 seconds

# Network Configuration
WSL_HOST=10.1.0.26
REMOTE_CLIENT_HOST=10.0.0.44
```

### 4. Code Changes in Existing AI Service

Update your existing AI service to use the enhanced WSL-based system.

#### Create Enhanced AI Client (`enhanced-ai-client.js`)
```javascript
const fetch = require('node-fetch');

class EnhancedAIClient {
    constructor(baseUrl = 'http://10.1.0.26:3001') {
        this.baseUrl = baseUrl;
        this.timeout = 30000; // 30 seconds
        this.maxRetries = 2;
    }

    async processQuestion(questionId) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
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
                return result;

            } catch (error) {
                console.error(`Enhanced AI attempt ${attempt} failed:`, error.message);
                
                if (attempt === this.maxRetries) {
                    throw error;
                }
                
                await this.sleep(1000 * attempt);
            }
        }
    }

    async resetRecord(questionId) {
        try {
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

            return await response.json();
        } catch (error) {
            console.error('Error resetting record:', error);
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
            console.error('Error getting status:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                timeout: 5000
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = EnhancedAIClient;
```

#### Update Main AI Service Integration
```javascript
const EnhancedAIClient = require('./enhanced-ai-client');
const OriginalAIService = require('./original-ai-service'); // Your existing service

class HybridAIService {
    constructor() {
        this.enhancedClient = new EnhancedAIClient();
        this.originalService = new OriginalAIService();
        this.useEnhanced = process.env.USE_ENHANCED_AI === 'true';
        this.fallbackToLocal = process.env.FALLBACK_TO_LOCAL_AI === 'true';
    }

    async processQuestion(questionId) {
        if (this.useEnhanced) {
            try {
                // Try enhanced AI service first
                console.log(`🚀 Using enhanced AI service for question ${questionId}`);
                return await this.enhancedClient.processQuestion(questionId);
            } catch (error) {
                console.error(`❌ Enhanced AI failed for question ${questionId}:`, error.message);
                
                if (this.fallbackToLocal) {
                    console.log(`🔄 Falling back to local AI for question ${questionId}`);
                    return await this.originalService.processQuestion(questionId);
                } else {
                    throw error;
                }
            }
        } else {
            // Use original service
            return await this.originalService.processQuestion(questionId);
        }
    }

    async getSystemStatus() {
        const status = {
            timestamp: new Date().toISOString(),
            enhanced: {
                enabled: this.useEnhanced,
                healthy: false,
                status: null
            },
            original: {
                available: this.fallbackToLocal,
                healthy: false
            }
        };

        // Check enhanced service
        if (this.useEnhanced) {
            try {
                status.enhanced.healthy = await this.enhancedClient.healthCheck();
                if (status.enhanced.healthy) {
                    status.enhanced.status = await this.enhancedClient.getStatus();
                }
            } catch (error) {
                console.error('Error checking enhanced AI status:', error);
            }
        }

        // Check original service
        if (this.fallbackToLocal) {
            try {
                status.original.healthy = await this.originalService.healthCheck();
            } catch (error) {
                console.error('Error checking original AI status:', error);
            }
        }

        return status;
    }
}

module.exports = HybridAIService;
```

### 5. Database Schema Updates (Optional)

Add tracking columns to monitor AI service usage:

```sql
-- Add columns to track AI service usage
ALTER TABLE questions_answers 
ADD COLUMN processed_by VARCHAR(50) DEFAULT 'original',
ADD COLUMN processing_time INTEGER,
ADD COLUMN used_rag BOOLEAN DEFAULT FALSE,
ADD COLUMN rag_sources TEXT[];

-- Create index for performance
CREATE INDEX idx_questions_answers_processed_by ON questions_answers(processed_by);
CREATE INDEX idx_questions_answers_used_rag ON questions_answers(used_rag);
```

### 6. Monitoring and Logging

#### Add Health Check Endpoint
```javascript
// Add to your existing web service
app.get('/api/ai-status', async (req, res) => {
    try {
        const aiService = new HybridAIService();
        const status = await aiService.getSystemStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

#### Add Logging Configuration
```javascript
// Enhanced logging for AI service calls
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/ai-service.log' }),
        new winston.transports.Console()
    ]
});

// Log AI service calls
logger.info('AI service call', {
    questionId,
    service: 'enhanced',
    timestamp: new Date().toISOString()
});
```

## Testing the Integration

### 1. Network Connectivity Test
```bash
# From remote client, test connectivity to WSL services
curl -v http://10.1.0.26:3001/health
curl -v http://10.1.0.26:11434/api/version
curl -v http://10.1.0.26:8000/api/v1/heartbeat
```

### 2. Database Connectivity Test
```bash
# From WSL, test database connection
psql -h 10.0.0.44 -U postgres -d clipboard -c "SELECT 1;"
```

### 3. End-to-End Test
```bash
# Submit a test question through your web interface
# Monitor logs on both systems:

# On remote client:
tail -f logs/ai-service.log

# On WSL:
docker-compose logs -f ai-service
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check firewall settings
   - Verify service is running: `docker-compose ps`
   - Check network connectivity: `ping 10.1.0.26`

2. **Database Connection Failed**
   - Verify PostgreSQL is accepting connections
   - Check `pg_hba.conf` configuration
   - Test with: `telnet 10.0.0.44 5432`

3. **Timeout Issues**
   - Increase timeout values in environment
   - Check system resources on WSL
   - Monitor with: `docker stats`

4. **Performance Issues**
   - Monitor GPU usage: `nvidia-smi`
   - Check disk space: `df -h`
   - Review logs for errors

### Log Locations

- **Remote Client**: `./logs/ai-service.log`
- **WSL System**: `docker-compose logs ai-service`
- **PostgreSQL**: `/var/log/postgresql/`

## Backup and Recovery

### Database Backup
```bash
# Create backup of existing data
pg_dump -h localhost -U postgres clipboard > backup_before_upgrade.sql
```

### Configuration Backup
```bash
# Backup existing configuration
cp .env .env.backup
cp docker-compose.yml docker-compose.yml.backup
```

## Performance Optimization

### WSL Resource Allocation
Create/update `.wslconfig` in Windows user directory:
```ini
[wsl2]
memory=16GB
processors=8
swap=8GB
localhostForwarding=true
```

### Docker Resource Limits
Update docker-compose.yml if needed:
```yaml
services:
  ai-service:
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

This setup provides a robust, scalable AI system that leverages GPU acceleration on your WSL desktop while maintaining compatibility with your existing remote client infrastructure. 