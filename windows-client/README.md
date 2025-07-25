# Windows Clipboard Capture Client

This is the Windows client application for the Clipboard-to-TTS system. It runs as a background service and captures clipboard content when you press **CTRL+ALT+C**.

## Features

- 🎯 **Global Hotkey**: CTRL+ALT+C to capture clipboard content
- 🔄 **Auto-Retry**: Automatic database reconnection with exponential backoff
- 🌐 **Dual-Path Connection**: LAN IP first, then web domain fallback
- 📊 **Statistics**: Track captures and success/failure rates
- 🪟 **Background Service**: Runs invisibly in the background
- 📝 **Comprehensive Logging**: File and console logging with emojis

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
   🚀 Starting Clipboard Capture Service...
   ✅ Connected to database via 10.0.0.44:5432
   ⌨️ Hotkey registered: CTRL+ALT+C
   ✅ Clipboard Capture Service is running
   Press CTRL+ALT+C to capture clipboard content
   Press CTRL+C to stop the service
   ```

2. **Capture clipboard content**:
   - Copy any text to your clipboard
   - Press **CTRL+ALT+C**
   - The text will be automatically inserted into the database
   - AI processing will begin automatically

3. **Stop the service**:
   - Press **CTRL+C** in the terminal
   - Or close the terminal window

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

**Hotkey not working globally:**
- Run as Administrator
- Check if another application is using the same hotkey

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
- Runtime duration
- Total clipboard captures
- Successful database inserts
- Failed insert attempts

Example output on shutdown:
```
📊 Service Statistics:
  Runtime: 1847.3 seconds
  Captures: 15
  Successful inserts: 14
  Failed inserts: 1
```

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