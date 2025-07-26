# Windows Clipboard Capture Client

This is the Windows client application for the Clipboard-to-TTS system. It runs as a background service and captures clipboard content when you press **CTRL+ALT+C**.

## Features

- 🎯 **Global Hotkeys**: CTRL+ALT+C to capture clipboard, CTRL+SHIFT+Q to stop service
- 🔄 **Auto-Retry**: Automatic database reconnection with exponential backoff
- 🔁 **Auto-Restart**: Service automatically restarts if it dies or crashes
- 🛡️ **Service Guardian**: Monitors service health and handles restarts
- 🌐 **Dual-Path Connection**: LAN IP first, then web domain fallback
- 📊 **Statistics**: Track captures, success/failure rates, and restart count
- 🪟 **Background Service**: Runs invisibly in the background
- 📝 **Comprehensive Logging**: File and console logging with emojis
- ⌨️ **Health Monitoring**: Automatic hotkey re-registration if lost

## Requirements

- Windows 10 or newer
- Python 3.7 or newer
- Administrator privileges (recommended for global hotkeys)

## Installation

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables**:
   Copy the example environment file and configure it:
   ```bash
   copy env.example .env
   ```
   
   Then edit `.env` with your actual database configuration:
   ```bash
   DB_NAME=clipboard_tts
   DB_USER=postgres
   DB_PASSWORD=your_password
   LAN_IP=10.0.0.44
   DB_DOMAIN=db.korczewski.de
   DB_PORT=5432
   ```

3. **Test your configuration** (Recommended):
   Before running the main service, test your database connection:
   ```bash
   python test_connection.py
   ```
   This will verify your `.env` configuration and test both LAN IP and database domain connections.

4. **Windows Console Encoding** (Fixed automatically):
   The client automatically handles Unicode emoji display issues on Windows by:
   - Setting UTF-8 encoding when possible
   - Falling back to ASCII-friendly icons when emojis aren't supported
   - Using proper console encoding configuration

## Usage

### Running the Client

1. **Run as Administrator** (recommended):
   - Right-click on Command Prompt or PowerShell
   - Select "Run as administrator"
   - Navigate to the windows-client directory
   - Run: `python clipboard_capture.py`

2. **Or run normally**:
   ```bash
   python clipboard_capture.py
   ```

### Using the Service

1. **Start the service** - you'll see:
   ```
   🎯 Clipboard-to-TTS Windows Client v2.0 (Auto-Restart)
   🛡️ Service Guardian started
   Service will automatically restart if it dies
   Use CTRL+SHIFT+Q to stop the service completely
   🚀 Starting Clipboard Capture Service...
   ✅ Connected to database via 10.0.0.44:5432
   ⌨️ Hotkeys registered: CTRL+ALT+C (capture), CTRL+SHIFT+Q (stop)
   ✅ Clipboard Capture Service is running
   Press CTRL+ALT+C to capture clipboard content
   Use CTRL+SHIFT+Q to stop the service
   ```

2. **Capture clipboard content**:
   - Copy any text to your clipboard
   - Press **CTRL+ALT+C**
   - The text will be automatically inserted into the database
   - AI processing will begin automatically

3. **Automatic restart behavior**:
   - If the service crashes or dies, it will automatically restart
   - Restart delay starts at 5 seconds and increases with each failure (up to 60 seconds)
   - No manual intervention needed - the service keeps running
   - Statistics track restart count and total runtime

4. **Stop the service**:
   - Press **CTRL+SHIFT+Q** (works from anywhere, even when terminal is not focused)
   - Or close the terminal window
   - The service guardian will handle graceful shutdown
   
   **Note**: CTRL+C will NOT stop the service (since that's used for copying on Windows)

## Connection Logic

The client uses a dual-path connection strategy:

1. **Primary**: Direct connection to LAN IP (10.0.0.44:5432)
2. **Fallback**: Connection via database domain (db.korczewski.de:5432)
3. **Retry**: Exponential backoff with up to 5 retry attempts

## Logging

- **Console Output**: Real-time status with emoji indicators
- **Log File**: Detailed logs saved to `clipboard_capture.log`
- **Statistics**: Tracks captures, successful inserts, and failures

## Troubleshooting

### Common Issues

**Unicode/Emoji display errors (FIXED):**
- The client now automatically handles Windows console encoding issues
- No manual configuration needed - works with both UTF-8 and legacy encodings

**Hotkeys not working globally:**
- Run as Administrator
- Check if another application is using CTRL+ALT+C or CTRL+SHIFT+Q
- The service will automatically attempt to re-register hotkeys if they become unregistered
- Look for hotkey re-registration messages in the logs

**Service won't stop:**
- Use **CTRL+SHIFT+Q** instead of CTRL+C (CTRL+C is disabled to avoid conflicts with copying)
- Or close the terminal window
- Check that the hotkey isn't being blocked by another application

**Database connection failed:**
- Verify your `.env` file configuration (copy from `env.example`)
- Check if the database server is running
- Ensure network connectivity to the LAN IP or database domain

**Permission errors:**
- Run as Administrator
- Check Windows Defender or antivirus software

**Python package errors:**
- Install all requirements: `pip install -r requirements.txt`
- Consider using a virtual environment

### Log Analysis

Check the log file for detailed error information:
```bash
# View recent logs
tail -f clipboard_capture.log

# Search for errors
findstr "ERROR" clipboard_capture.log
```

## Service Statistics

The client tracks and displays:
- Total runtime duration
- Restart count (how many times the service auto-restarted)
- Total clipboard captures
- Successful database inserts
- Failed insert attempts

Example output on shutdown:
```
📊 Final Service Statistics:
  Total runtime: 1847.3 seconds
  Restart count: 3
  Total captures: 15
  Successful inserts: 14
  Failed inserts: 1
```

## Auto-Restart Features

The new v2.0 client includes robust auto-restart capabilities:

- **Service Guardian**: Monitors the main service and restarts it if it dies
- **Exponential Backoff**: Restart delay increases from 5 seconds to max 60 seconds
- **Health Monitoring**: Automatically re-registers hotkeys if they become unregistered
- **Error Recovery**: Handles database connection failures, hotkey registration issues, and unexpected crashes
- **Graceful Shutdown**: Only stops completely when you press CTRL+C or close the terminal
- **Persistent Statistics**: Restart count and cumulative statistics are maintained across restarts

## Development

For development and debugging:

1. **Test database connection** (Easiest method):
   ```bash
   python test_connection.py
   ```

2. **Enable debug logging** in your `.env`:
   ```bash
   DEBUG=true
   ```

3. **Manual database connection test**:
   ```python
   from clipboard_capture import DatabaseConnector
   db = DatabaseConnector()
   success = db.connect()
   print(f"Connection: {'✅' if success else '❌'}")
   ```

4. **Test clipboard functionality**:
   ```python
   from clipboard_capture import ClipboardCapture
   text = ClipboardCapture.get_clipboard_text()
   print(f"Clipboard: {text}")
   ``` 