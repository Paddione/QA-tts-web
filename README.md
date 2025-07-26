# Clipboard-to-TTS System

A distributed application that captures clipboard content, processes it through AI to generate intelligent responses, converts those responses to speech, and provides a web interface for playback and management.

> **⚠️ Installation Note**: This is a Docker-based system. Do NOT run `pip install` on the main directory. For the Windows client, navigate to `windows-client/` first and follow the instructions there.

## 🎯 Features

- **AI-Powered Responses**: Automatically generates intelligent answers using Google's Gemini AI
- **Text-to-Speech**: Converts AI responses to high-quality audio using Google Cloud TTS
- **Web Interface**: Beautiful, responsive web UI for browsing and playing question-answer pairs
- **Real-time Processing**: Event-driven architecture with instant processing notifications
- **Docker Orchestration**: Complete containerized deployment with Docker Compose
- **Scalable Architecture**: Microservices design with PostgreSQL database

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Windows Client │    │   PostgreSQL     │    │   Web App       │
│  (Planned)      │───▶│   Database       │◀───│   (Port 3000)   │
└─────────────────┘    │                  │    └─────────────────┘
                       │  ┌─────────────┐ │              │
                       │  │ Triggers &  │ │              │
                       │  │ Notifications│ │              │
                       │  └─────────────┘ │              │
                       └─────────┬────────┘              │
                                │                        │
                  ┌─────────────┴─────────────┐          │
                  │                           │          │
                  ▼                           ▼          │
        ┌─────────────────┐         ┌─────────────────┐  │
        │   AI Service    │         │   TTS Service   │  │
        │   (Gemini API)  │         │  (Google TTS)   │  │
        └─────────────────┘         └─────────────────┘  │
                                            │             │
                                            ▼             │
                                    ┌─────────────────┐   │
                                    │   MP3 Files     │◀──┘
                                    │   /public/mp3/  │
                                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

**For Main System (Docker Services):**
- Docker and Docker Compose
- Google Gemini API key
- Google Cloud Text-to-Speech API key (optional, can use default auth)

**For Windows Client (Optional):**
- Windows 10 or newer
- Python 3.7 or newer
- Administrator privileges (recommended)

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ScreenshotOCR
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables** in `.env`:
   ```bash
   # Database Configuration
   DB_NAME=clipboard_tts
   DB_USER=postgres
   DB_PASSWORD=your_secure_password
   
   # API Keys
   GEMINI_API_KEY=your_gemini_api_key_here
   GEM_ID=gemini-pro
   GOOGLE_TTS_KEY=your_google_tts_key_here
   
   # Enhanced AI Configuration (Optional)
   USE_ENHANCED_AI=true
   ENHANCED_AI_SERVICE_URL=http://10.1.0.26:3001
   FALLBACK_TO_LOCAL_AI=true
   
   # Network Configuration
   WEB_DOMAIN=web.korczewski.de
   DB_HOST=db.korczewski.de
   ```

4. **Configure Google Cloud Text-to-Speech**:
   
   The system supports multiple authentication methods for Google TTS:
   
   **Option A: Service Account (Recommended)**
   - Place your Google service account JSON file in the project root
   - The system will automatically detect and use: `gen-lang-client-0899352753-bf1b34113193.json`
   - No additional configuration needed
   
   **Option B: API Key**
   - Set `GOOGLE_TTS_KEY` in your `.env` file
   - Useful for simpler setups or testing
   
   **Option C: Default Authentication**
   - Uses Google Cloud environment variables
   - Useful for production deployments with IAM roles

5. **German Voice Configuration**:
   
   The system is pre-configured to use German text-to-speech. You can customize the voice settings:
   
   ```bash
   # German TTS Voice Configuration (already set in docker-compose.yml)
   TTS_LANGUAGE_CODE=de-DE          # German (Germany)
   TTS_VOICE_NAME=de-DE-Standard-A  # German female voice
   TTS_VOICE_GENDER=FEMALE          # Voice gender
   TTS_SPEAKING_RATE=1.0           # Speaking speed (0.25-4.0)
   TTS_PITCH=0.0                   # Voice pitch (-20.0 to 20.0)
   TTS_VOLUME_GAIN=0.0             # Volume adjustment in dB (-96.0 to 16.0)
   ```
   
   **Available German Voices:**
   - `de-DE-Standard-A` (Female) - Standard quality
   - `de-DE-Standard-B` (Male) - Standard quality  
   - `de-DE-Wavenet-A` (Female) - High quality (premium)
   - `de-DE-Wavenet-B` (Male) - High quality (premium)
   - `de-DE-Neural2-A` (Female) - Neural voice (premium)
   - `de-DE-Neural2-B` (Male) - Neural voice (premium)

6. **Start the system**:
   ```bash
   docker-compose up -d
   ```

7. **Access the web interface**:
   Open your browser to `http://localhost:3000`

## 🔧 Development & Maintenance

### Rebuild Script

The project includes an interactive rebuild script (`rebuild.sh`) that allows you to selectively rebuild and restart services:

```bash
# Make the script executable (first time only)
chmod +x rebuild.sh

# Run the interactive rebuild script
./rebuild.sh
```

### Google TTS Setup

The project includes a setup script to help configure Google Cloud Text-to-Speech:

```bash
# Make the script executable (first time only)
chmod +x setup-google-tts.sh

# Run the TTS setup script
./setup-google-tts.sh
```

**Features:**
- Validates your Google service account JSON file
- Checks Docker Compose configuration 
- Tests TTS service authentication
- Provides helpful troubleshooting guidance
- Shows authentication method in use

The system supports three authentication methods for Google TTS (in order of priority):
1. **Service Account JSON** (Recommended): Automatically detected if file is present
2. **API Key**: Set `GOOGLE_TTS_KEY` in your `.env` file  
3. **Default Authentication**: Uses Google Cloud environment variables

### Database Reset Scripts

Two database reset scripts are available for resetting the PostgreSQL database:

#### Full Reset Script (`reset_database.sh`)
A comprehensive script with verification and testing:

```bash
# Make executable (first time only)
chmod +x reset_database.sh

# Run the full reset with verification
./reset_database.sh
```

**Features:**
- Interactive confirmation prompt
- Safe service shutdown
- Complete database drop and recreation
- Schema verification
- Trigger and function testing
- Service restart and health check

#### Quick Reset Script (`quick_reset_db.sh`)
A simplified script for faster resets:

```bash
# Make executable (first time only)
chmod +x quick_reset_db.sh

# Run quick reset
./quick_reset_db.sh
```

**Features:**
- Simple y/N confirmation
- Rapid database reset
- Immediate service restart
- Minimal output

**⚠️ Warning:** Both scripts will completely destroy all existing data in the database. This action cannot be undone.

**Available options:**
- **🌐 Rebuild Web App only** - For frontend/backend changes
- **🤖 Rebuild AI Service only** - For Gemini integration changes  
- **🎵 Rebuild TTS Service only** - For TTS functionality changes
- **🗄️ Restart PostgreSQL only** - For database issues
- **🌍 Restart Nginx Proxy Manager only** - For proxy configuration
- **🔨 Rebuild combinations** - Web+AI, Web+TTS, AI+TTS, or all apps
- **🔄 Complete System Rebuild** - Full rebuild of everything
- **⚙️ Docker Cleanup** - Remove unused images and containers
- **📋 View service logs** - Debug and monitor services
- **⚙️ Show container status** - Check current service state

The script includes:
- Pre-flight checks (Docker running, .env file exists)
- Colored output with emojis for better UX
- Real-time container status display
- Safe error handling and confirmation prompts

## 📱 Usage

### Windows Client Setup

**⚠️ Important**: The Windows client is a separate component that requires its own setup. Do NOT run `pip install` on the main project directory.

1. **Navigate to the Windows client directory**:
   ```bash
   cd windows-client
   ```

2. **Install Windows client dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure the client**:
   ```bash
   copy env.example .env
   # Edit .env with your database settings
   ```

4. **Test the connection** (recommended):
   ```bash
   python test_connection.py
   ```

5. **Run the client as Administrator**:
   ```bash
   python clipboard_capture.py
   ```

For detailed Windows client setup instructions, see `windows-client/README.md`.

### Web Interface

The web application provides a complete interface for managing your question-answer pairs:

- **📋 Records List**: Scrollable sidebar showing all captured questions
- **❓ Question Display**: View the original captured question
- **💬 AI Answer**: Read the generated AI response
- **🎵 Audio Player**: Play the text-to-speech audio with full controls
  - Play/Pause (Space bar)
  - Restart (R key)
  - Speed Control (S key) - 0.5x to 2.0x
  - Volume Control
  - Progress Seeking
- **🗑️ Delete Records**: Remove questions and associated audio files
- **🔄 Auto-Refresh**: Real-time updates for processing records

### API Endpoints

The system provides a REST API for integration:

```bash
# Get all record IDs
GET /api/records

# Get specific record details
GET /api/records/:id

# Create new question (for testing)
POST /api/records
{
  "question": "What is the capital of France?"
}

# Delete record and associated MP3
DELETE /api/records/:id

# Health check
GET /health
```

### Manual Testing

You can test the system in multiple ways:

**Via Windows Client (Recommended):**
1. Set up and run the Windows client (see `windows-client/README.md`)
2. Copy any text to your clipboard (CTRL+C works normally)
3. Press **CTRL+ALT+C** to capture and process it
4. Use **CTRL+SHIFT+Q** to stop the service when done

**Via API:**
```bash
# Create a test question
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain quantum computing in simple terms"}'

# The system will automatically:
# 1. Process the question with Gemini AI
# 2. Convert the answer to speech
# 3. Make it available in the web interface
```

## 🔧 Development

### Project Structure

```
├── ai-service/           # Gemini AI processing service
│   ├── src/
│   │   ├── index.js     # Main service
│   │   ├── database.js  # Database utilities
│   │   └── gemini-client.js # AI integration
│   ├── Dockerfile
│   └── package.json
├── tts-service/          # Text-to-Speech service
│   ├── src/
│   │   ├── index.js     # Main service
│   │   ├── database.js  # Database utilities
│   │   └── tts-client.js # TTS integration
│   ├── Dockerfile
│   └── package.json
├── web-app/              # Web application
│   ├── src/
│   │   ├── server.js    # Express server
│   │   └── database.js  # Database utilities
│   ├── public/
│   │   ├── index.html   # Main UI
│   │   ├── css/styles.css # Styling
│   │   └── js/app.js    # Frontend logic
│   ├── Dockerfile
│   └── package.json
├── database/
│   └── init/
│       └── 01-init.sql  # Database schema
├── windows-client/       # Windows clipboard capture client
├── docs/                 # Documentation
├── docker-compose.yml    # Orchestration
├── rebuild.sh            # Interactive rebuild script
└── .env.example         # Environment template
```

### Service Communication

The system uses PostgreSQL notifications for real-time event processing:

1. **Question Inserted** → Triggers `new_question` notification → AI Service processes
2. **Answer Added** → Triggers `new_answer` notification → TTS Service processes
3. **MP3 Created** → Web interface can play audio

### Database Schema

```sql
CREATE TABLE questions_answers (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    mp3path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🐳 Docker Services

- **postgres**: PostgreSQL database with persistent storage
- **ai-service**: Gemini AI processing service
- **tts-service**: Google Text-to-Speech service
- **web-app**: Express.js web application (port 3000)

All services are connected via an internal Docker network and automatically restart on failure.

## 🔐 Security

- Environment variable configuration for API keys
- CORS and security headers enabled
- Internal Docker networking
- Input validation and error handling
- No sensitive data logged

## 📊 Monitoring

- Health check endpoint at `/health`
- Structured logging with emojis for easy debugging
- Connection status indicators in web UI
- Automatic service recovery and reconnection

## 🚧 Roadmap

### Upcoming Features

1. **SSL Access**: Nginx Proxy Manager configuration
2. **Advanced Testing**: Comprehensive test suite
3. **Enhanced Logging**: Centralized logging with correlation IDs
4. **Performance Metrics**: Monitoring and analytics
5. **Enhanced Windows Client**: GUI interface and system tray support

### Latest Updates

**Windows Client v2.0 (Just Released):**
- ✅ **CTRL+ALT+C clipboard capture** - Fully implemented
- ✅ **Auto-restart functionality** - Service automatically restarts if it dies
- ✅ **Service Guardian** - Monitors service health and handles recovery
- ✅ **Health monitoring** - Automatic hotkey re-registration
- ✅ **Robust error handling** - Database reconnection with exponential backoff
- ✅ **Comprehensive logging** - File and console logging with statistics

### Known Limitations

- External SSL access requires manual Nginx setup
- No user authentication (single-user system)
- Limited audio format support (MP3 only)
- Windows client requires manual terminal operation (GUI planned for future)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🔧 Recent Fixes & Improvements

### Audio Error Resolution (Latest Update)
- **Fixed**: Frequent audio loading errors that appeared in browser console
- **Improved**: Better error handling with automatic retry mechanism
- **Enhanced**: Shows "Audio is being generated" message while TTS processing
- **Added**: Graceful handling of missing or corrupted audio files

### CSS Loading Issue Resolution
- **Fixed**: Content Security Policy blocking Google Fonts
- **Updated**: CSP configuration to allow fonts.googleapis.com and fonts.gstatic.com
- **Result**: Google Fonts now load properly without CSP violations

### Audio Player Improvements
- **Enhanced**: Better feedback when audio files are being generated
- **Added**: Automatic file existence checking before loading
- **Improved**: Less noisy error logging for transient audio issues
- **Fixed**: Proper audio player restoration after TTS completion

## 🆘 Troubleshooting

### Common Issues

**"Getting requirements to build wheel did not run successfully" error:**
This happens when you try to run `pip install` on the main project directory. The main project is a Docker-based system, not a Python package.

**Solution:**
1. Navigate to the Windows client directory: `cd windows-client`
2. Install only the Windows client dependencies: `pip install -r requirements.txt`
3. Follow the Windows client setup instructions in `windows-client/README.md`

**Services won't start:**
```bash
# Use the interactive rebuild script
./rebuild.sh

# Or manually check logs and restart
docker-compose logs
docker-compose restart ai-service
```

**Database connection issues:**
```bash
# Check database is running
docker-compose ps postgres

# Reset database
docker-compose down -v
docker-compose up -d
```

**Audio not playing:**
- The system now automatically handles missing audio files during generation
- Shows "Audio is being generated" message while TTS processes
- Check browser audio permissions if needed
- Verify MP3 files in `./public/mp3/` directory
- Check TTS service logs: `docker-compose logs tts-service`

**AI not responding:**
- Verify GEMINI_API_KEY is set correctly
- Check AI service logs: `docker-compose logs ai-service`
- Ensure internet connectivity for API calls

**CSS/Font Loading Issues:**
- Fixed: Google Fonts should now load without CSP violations
- If issues persist, check browser console for any remaining CSP errors

For more detailed troubleshooting, check the service logs and the `/health` endpoint. 