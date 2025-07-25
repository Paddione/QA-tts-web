# Enhanced AI Integration Guide

This document provides a complete guide for integrating the Clipboard-to-TTS system with the enhanced AI service running on WSL (10.1.0.26).

## Overview

The enhanced AI integration allows the remote client (10.0.0.44) to use advanced AI capabilities including:

- **Local LLM Models**: Ollama-powered language models running on WSL
- **RAG (Retrieval Augmented Generation)**: Enhanced answers using vector database search
- **Fallback Support**: Automatic fallback to Gemini API if enhanced service fails
- **Performance Tracking**: Monitor which AI service processed each question

## Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Remote Client         │     │   WSL Desktop           │
│   10.0.0.44             │◄────┤   10.1.0.26             │
│                         │     │                         │
│ ┌─────────────────────┐ │     │ ┌─────────────────────┐ │
│ │ Web App             │ │     │ │ Ollama              │ │
│ │ TTS Service         │ │     │ │ Chroma Vector DB    │ │
│ │ PostgreSQL          │ │     │ │ n8n Workflows       │ │
│ │ Hybrid AI Service   │ │     │ │ Enhanced AI Service │ │
│ └─────────────────────┘ │     │ └─────────────────────┘ │
└─────────────────────────┘     └─────────────────────────┘
```

## Component Overview

### 1. Hybrid AI Service
- **Location**: `ai-service/src/hybrid-ai-service.js`
- **Purpose**: Orchestrates between enhanced and fallback AI services
- **Features**: 
  - Automatic service selection
  - Fallback handling
  - Performance tracking
  - Status monitoring

### 2. Enhanced AI Client
- **Location**: `ai-service/src/enhanced-ai-client.js`
- **Purpose**: Communicates with WSL-based AI service
- **Features**:
  - HTTP client for enhanced AI service
  - Retry logic with exponential backoff
  - Health checking
  - Timeout handling

### 3. Database Enhancements
- **Location**: `database/migrations/02-enhanced-ai-columns.sql`
- **Purpose**: Track AI service usage and RAG features
- **New Columns**:
  - `processed_by`: Which AI service was used
  - `processing_time`: Time taken in milliseconds
  - `used_rag`: Whether RAG was utilized
  - `rag_sources`: Array of source document references

## Quick Setup

### 1. Run the Setup Script

The easiest way to configure the enhanced AI integration is to use the setup script:

```bash
# Make sure you're in the project directory
cd /path/to/ScreenshotOCR

# Run the setup script
./setup-enhanced-ai.sh
```

The script will:
- Test WSL connectivity
- Configure PostgreSQL for WSL access
- Set up firewall rules
- Update Docker Compose configuration
- Apply database migrations
- Test the enhanced AI service

### 2. Manual Configuration

If you prefer manual setup or need to troubleshoot:

#### Environment Configuration

Create or update your `.env` file with these variables:

```bash
# Enhanced AI Service Configuration
USE_ENHANCED_AI=true
ENHANCED_AI_SERVICE_URL=http://10.1.0.26:3001
FALLBACK_TO_LOCAL_AI=true
LOCAL_AI_TIMEOUT=30000

# Network Configuration
WSL_HOST=10.1.0.26
REMOTE_CLIENT_HOST=10.0.0.44

# Keep existing Gemini configuration for fallback
GEMINI_API_KEY=your_gemini_api_key
GEM_ID=gemini-2.0-flash-exp
```

#### PostgreSQL Configuration

Update PostgreSQL to accept connections from WSL:

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf
# Change: listen_addresses = 'localhost,10.0.0.44'

# Edit pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host all all 10.1.0.26/32 md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Firewall Configuration

Allow necessary ports:

```bash
# Using UFW
sudo ufw allow from 10.1.0.26 to any port 5432 comment "PostgreSQL from WSL"
sudo ufw allow out to 10.1.0.26 port 3001 comment "AI Service on WSL"
sudo ufw allow out to 10.1.0.26 port 11434 comment "Ollama on WSL"
sudo ufw allow out to 10.1.0.26 port 8000 comment "Chroma on WSL"
```

#### Database Migration

Apply the enhanced AI database schema:

```bash
docker-compose exec -T postgres psql -U postgres -d clipboard_tts < database/migrations/02-enhanced-ai-columns.sql
```

## Testing the Integration

### 1. Network Connectivity Tests

Test basic connectivity to WSL services:

```bash
# Test WSL host
ping 10.1.0.26

# Test enhanced AI service
curl http://10.1.0.26:3001/health

# Test Ollama
curl http://10.1.0.26:11434/api/version

# Test Chroma
curl http://10.1.0.26:8000/api/v1/heartbeat
```

### 2. Database Connectivity Test

From WSL, test database connection:

```bash
psql -h 10.0.0.44 -U postgres -d clipboard_tts -c "SELECT 1;"
```

### 3. End-to-End Test

1. **Start the services**:
   ```bash
   docker-compose up -d
   ```

2. **Check AI service status**:
   ```bash
   curl http://localhost:3000/api/ai-status
   ```

3. **Test question processing**:
   ```bash
   # Create a test question
   curl -X POST http://localhost:3000/api/records \
     -H "Content-Type: application/json" \
     -d '{"question": "What is quantum computing?"}'
   
   # Check the logs
   docker-compose logs -f ai-service
   ```

## Monitoring and Debugging

### 1. Service Status

Check the status of all AI services:

```bash
# Web interface AI status
curl http://localhost:3000/api/ai-status

# Direct enhanced AI service
curl http://10.1.0.26:3001/status

# Service health
curl http://10.1.0.26:3001/health
```

### 2. Logs

Monitor service logs:

```bash
# AI service logs
docker-compose logs -f ai-service

# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web-app
```

### 3. Database Monitoring

Check AI service usage:

```sql
-- Connect to database
psql -h localhost -U postgres -d clipboard_tts

-- Check AI service usage
SELECT 
    processed_by,
    COUNT(*) as count,
    AVG(processing_time) as avg_time_ms,
    COUNT(*) FILTER (WHERE used_rag = true) as rag_count
FROM questions_answers 
WHERE processed_by IS NOT NULL
GROUP BY processed_by;

-- Recent questions with AI service info
SELECT 
    id,
    LEFT(question, 50) as question_preview,
    processed_by,
    processing_time,
    used_rag,
    created_at
FROM questions_answers 
ORDER BY created_at DESC 
LIMIT 10;
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_ENHANCED_AI` | `false` | Enable enhanced AI service |
| `ENHANCED_AI_SERVICE_URL` | `http://10.1.0.26:3001` | Enhanced AI service endpoint |
| `FALLBACK_TO_LOCAL_AI` | `true` | Enable fallback to Gemini |
| `LOCAL_AI_TIMEOUT` | `30000` | Timeout in milliseconds |
| `WSL_HOST` | `10.1.0.26` | WSL machine IP |
| `REMOTE_CLIENT_HOST` | `10.0.0.44` | Remote client IP |

### AI Service Behavior

The hybrid AI service follows this logic:

1. **Enhanced AI Enabled**: 
   - Try enhanced AI service first
   - If fails and fallback enabled: use Gemini
   - If fails and no fallback: return error

2. **Enhanced AI Disabled**:
   - Use Gemini API directly

3. **Fallback Scenarios**:
   - Network connectivity issues
   - Service timeout
   - HTTP errors (500, 502, 503, 504)
   - Service returns unsuccessful result

## Troubleshooting

### Common Issues

#### 1. Connection Refused to Enhanced AI Service

**Symptoms**: `ECONNREFUSED` errors in AI service logs

**Solutions**:
- Check if enhanced AI service is running on WSL
- Verify WSL IP address (10.1.0.26)
- Test connectivity: `ping 10.1.0.26`
- Check firewall rules

#### 2. Database Connection Failed from WSL

**Symptoms**: Enhanced AI service can't connect to PostgreSQL

**Solutions**:
- Check PostgreSQL configuration (`postgresql.conf`, `pg_hba.conf`)
- Verify PostgreSQL is listening on correct IP
- Test from WSL: `psql -h 10.0.0.44 -U postgres -d clipboard_tts`
- Check firewall allows port 5432

#### 3. Service Always Falls Back to Gemini

**Symptoms**: All questions processed by Gemini despite enhanced AI enabled

**Solutions**:
- Check `USE_ENHANCED_AI=true` in environment
- Verify enhanced AI service is healthy: `curl http://10.1.0.26:3001/health`
- Check AI service logs for error messages
- Test enhanced AI endpoint manually

#### 4. Slow Response Times

**Symptoms**: Questions take very long to process

**Solutions**:
- Check WSL machine resources (CPU, RAM, GPU)
- Monitor network latency between machines
- Adjust `LOCAL_AI_TIMEOUT` if needed
- Check Ollama model performance

### Log Analysis

Common log patterns to look for:

```bash
# Enhanced AI success
grep "Enhanced AI successfully processed" logs/

# Fallback usage
grep "Falling back to local AI" logs/

# Connection errors
grep "ECONNREFUSED\|timeout\|failed" logs/

# Processing times
grep "processing_time" logs/
```

## Performance Optimization

### 1. Network Optimization

- Use gigabit ethernet between machines
- Minimize network hops
- Consider dedicated VLAN for AI traffic

### 2. WSL Resource Allocation

Update `.wslconfig` on Windows:

```ini
[wsl2]
memory=16GB
processors=8
swap=8GB
localhostForwarding=true
```

### 3. Enhanced AI Service Tuning

- Optimize Ollama model parameters
- Configure Chroma vector database indexes
- Tune n8n workflow performance

### 4. Database Optimization

- Monitor query performance
- Consider connection pooling adjustments
- Regular database maintenance

## Migration Path

If you're upgrading from the basic Gemini-only setup:

1. **Backup Current Setup**:
   ```bash
   # Backup database
   pg_dump clipboard_tts > backup_before_enhanced_ai.sql
   
   # Backup configuration
   cp .env .env.backup
   cp docker-compose.yml docker-compose.yml.backup
   ```

2. **Apply Updates**:
   ```bash
   # Pull latest code
   git pull origin main
   
   # Run setup script
   ./setup-enhanced-ai.sh
   ```

3. **Test Gradually**:
   - Start with `USE_ENHANCED_AI=false` to ensure basic functionality
   - Enable `USE_ENHANCED_AI=true` with `FALLBACK_TO_LOCAL_AI=true`
   - Monitor logs and performance
   - Gradually increase reliance on enhanced AI

4. **Rollback if Needed**:
   ```bash
   # Restore configuration
   cp .env.backup .env
   cp docker-compose.yml.backup docker-compose.yml
   
   # Restart services
   docker-compose restart
   ```

## Future Enhancements

Planned improvements for the enhanced AI integration:

1. **Load Balancing**: Multiple enhanced AI service instances
2. **Caching**: Response caching for common questions
3. **Model Selection**: Dynamic model selection based on question type
4. **Performance Analytics**: Detailed performance metrics and dashboards
5. **Auto-scaling**: Automatic scaling based on demand

## Support

For issues with the enhanced AI integration:

1. Check this documentation
2. Review logs: `docker-compose logs -f ai-service`
3. Test connectivity using the troubleshooting commands
4. Check the setup script output for any errors
5. Verify WSL enhanced AI service is running and healthy 