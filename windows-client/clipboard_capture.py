#!/usr/bin/env python3
"""
Windows Clipboard Capture Client for Clipboard-to-TTS System

This application runs as a background service and captures clipboard content
when CTRL+ALT+C is pressed, then inserts it into the database.

The service automatically restarts if it dies and has no hotkey to stop it.
Use CTRL+C or close the terminal to stop the service.
"""

import sys
import os
import time
import threading
import logging
import json
from typing import Optional, Dict, Any
import signal
import platform
import traceback
from datetime import datetime

# Set up UTF-8 encoding for Windows console
if platform.system() == "Windows":
    try:
        # Try to set UTF-8 encoding for console output
        import locale
        import codecs
        
        # Set console to UTF-8 if possible
        os.system('chcp 65001 >nul 2>&1')
        
        # Reconfigure stdout/stderr for UTF-8
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        else:
            # Fallback for older Python versions
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)
    except Exception:
        # If UTF-8 setup fails, we'll use ASCII fallback
        pass

# Required packages: pip install keyboard pyperclip psycopg2-binary python-dotenv
try:
    import keyboard
    import pyperclip
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing required package: {e}")
    print("Please install required packages:")
    print("pip install keyboard pyperclip psycopg2-binary python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Define emojis with ASCII fallbacks for Windows compatibility
class Icons:
    def __init__(self):
        self.use_emojis = self._can_use_emojis()
        
        if self.use_emojis:
            self.TARGET = "🎯"
            self.ROCKET = "🚀"
            self.REFRESH = "🔄"
            self.WARNING = "⚠️"
            self.ERROR = "❌"
            self.SUCCESS = "✅"
            self.KEYBOARD = "⌨️"
            self.CLIPBOARD = "📋"
            self.STOP = "🛑"
            self.STATS = "📊"
            self.PLUG = "🔌"
            self.BOOM = "💥"
            self.RESTART = "🔁"
            self.SHIELD = "🛡️"
        else:
            self.TARGET = "[TARGET]"
            self.ROCKET = "[START]"
            self.REFRESH = "[RETRY]"
            self.WARNING = "[WARN]"
            self.ERROR = "[ERROR]"
            self.SUCCESS = "[OK]"
            self.KEYBOARD = "[KEY]"
            self.CLIPBOARD = "[CLIP]"
            self.STOP = "[STOP]"
            self.STATS = "[STATS]"
            self.PLUG = "[CONN]"
            self.BOOM = "[CRASH]"
            self.RESTART = "[RESTART]"
            self.SHIELD = "[GUARD]"
    
    def _can_use_emojis(self):
        """Check if the terminal can display emojis"""
        try:
            # Test if we can encode emojis
            test_emoji = "🎯"
            test_emoji.encode(sys.stdout.encoding or 'ascii')
            return True
        except (UnicodeEncodeError, AttributeError):
            return False

icons = Icons()

# Configure logging with safe formatting
class SafeFormatter(logging.Formatter):
    def format(self, record):
        # Replace emojis in the message if needed
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            if not icons.use_emojis:
                # Replace common emojis with ASCII equivalents
                emoji_map = {
                    '🎯': '[TARGET]', '🚀': '[START]', '🔄': '[RETRY]',
                    '⚠️': '[WARN]', '❌': '[ERROR]', '✅': '[OK]',
                    '⌨️': '[KEY]', '📋': '[CLIP]', '🛑': '[STOP]',
                    '📊': '[STATS]', '🔌': '[CONN]', '💥': '[CRASH]',
                    '🔁': '[RESTART]', '🛡️': '[GUARD]'
                }
                for emoji, replacement in emoji_map.items():
                    record.msg = record.msg.replace(emoji, replacement)
        
        return super().format(record)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('clipboard_capture.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# Apply safe formatter to all handlers
for handler in logging.getLogger().handlers:
    handler.setFormatter(SafeFormatter('%(asctime)s - %(levelname)s - %(message)s'))

logger = logging.getLogger(__name__)


class DatabaseConnector:
    """Manages database connections with fallback logic"""
    
    def __init__(self):
        self.connection = None
        self.connection_params = self._get_connection_params()
        self.retry_delay = 1  # Start with 1 second
        self.max_retry_delay = 30  # Max 30 seconds
        self.max_retries = 5
        
    def _get_connection_params(self) -> list:
        """Get connection parameters with LAN IP first, then database domain fallback"""
        base_params = {
            'database': os.getenv('DB_NAME', 'clipboard_tts'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD'),
            'port': int(os.getenv('DB_PORT', 5432)),
            'connect_timeout': 10
        }
        
        # Primary: LAN IP connection
        lan_params = base_params.copy()
        lan_params['host'] = os.getenv('LAN_IP', '10.0.0.44')
        
        # Fallback: Database domain connection
        db_params = base_params.copy()
        db_params['host'] = os.getenv('DB_DOMAIN', 'db.korczewski.de')
        
        return [lan_params, db_params]
    
    def connect(self) -> bool:
        """Attempt to connect to database with fallback logic"""
        for attempt, params in enumerate(self.connection_params, 1):
            try:
                logger.info(f"{icons.REFRESH} Attempting database connection {attempt}/2 to {params['host']}:5432...")
                self.connection = psycopg2.connect(**params)
                self.connection.autocommit = True
                
                # Test the connection
                with self.connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                
                logger.info(f"{icons.SUCCESS} Connected to database via {params['host']}:5432")
                return True
                
            except psycopg2.Error as e:
                logger.warning(f"{icons.WARNING} Connection attempt {attempt} failed: {e}")
                if self.connection:
                    self.connection.close()
                    self.connection = None
        
        logger.error(f"{icons.ERROR} All database connection attempts failed")
        return False
    
    def reconnect_with_backoff(self) -> bool:
        """Reconnect with exponential backoff"""
        for retry in range(self.max_retries):
            delay = min(self.retry_delay * (2 ** retry), self.max_retry_delay)
            logger.info(f"{icons.REFRESH} Retrying connection in {delay} seconds... (attempt {retry + 1}/{self.max_retries})")
            time.sleep(delay)
            
            if self.connect():
                return True
        
        logger.error(f"{icons.ERROR} Failed to reconnect after all retries")
        return False
    
    def insert_question(self, question: str) -> Optional[int]:
        """Insert a new question into the database"""
        if not self.connection:
            logger.error(f"{icons.ERROR} No database connection available")
            return None
        
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "INSERT INTO questions_answers (question) VALUES (%s) RETURNING id",
                    (question,)
                )
                result = cursor.fetchone()
                question_id = result['id']
                
                logger.info(f"{icons.SUCCESS} Question inserted with ID: {question_id}")
                return question_id
                
        except psycopg2.Error as e:
            logger.error(f"{icons.ERROR} Database insert error: {e}")
            self.connection = None  # Mark connection as failed
            return None
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
            logger.info(f"{icons.PLUG} Database connection closed")


class ClipboardCapture:
    """Handles clipboard capture functionality"""
    
    @staticmethod
    def get_clipboard_text() -> str:
        """Get text content from clipboard"""
        try:
            text = pyperclip.paste()
            if text and text.strip():
                return text.strip()
            else:
                logger.warning(f"{icons.WARNING} Clipboard is empty or contains no text")
                return ""
        except Exception as e:
            logger.error(f"{icons.ERROR} Failed to get clipboard content: {e}")
            return ""


class ClipboardService:
    """Main service class that orchestrates clipboard capture and database insertion"""
    
    def __init__(self):
        self.db = DatabaseConnector()
        self.clipboard = ClipboardCapture()
        self.is_running = False
        self.should_restart = True
        self.stats = {
            'captures': 0,
            'successful_inserts': 0,
            'failed_inserts': 0,
            'start_time': None,
            'restart_count': 0
        }
    
    def start(self):
        """Start the clipboard capture service"""
        logger.info(f"{icons.ROCKET} Starting Clipboard Capture Service...")
        
        # Connect to database
        if not self.db.connect():
            logger.error(f"{icons.ERROR} Failed to establish initial database connection")
            if not self.db.reconnect_with_backoff():
                logger.error(f"{icons.ERROR} Could not establish database connection. Will retry later...")
                return False
        
        # Register hotkeys
        try:
            keyboard.add_hotkey('ctrl+alt+c', self._on_hotkey_pressed)
            keyboard.add_hotkey('ctrl+shift+q', self._on_stop_hotkey_pressed)
            logger.info(f"{icons.KEYBOARD} Hotkeys registered: CTRL+ALT+C (capture), CTRL+SHIFT+Q (stop)")
        except Exception as e:
            logger.error(f"{icons.ERROR} Failed to register hotkeys: {e}")
            return False
        
        self.is_running = True
        if self.stats['start_time'] is None:
            self.stats['start_time'] = time.time()
        
        logger.info(f"{icons.SUCCESS} Clipboard Capture Service is running")
        logger.info("Press CTRL+ALT+C to capture clipboard content")
        logger.info("Use CTRL+SHIFT+Q in terminal to stop the service")
        
        return True
    
    def _on_hotkey_pressed(self):
        """Handle capture hotkey press event"""
        if not self.is_running:
            return
            
        logger.info(f"{icons.TARGET} Hotkey pressed: CTRL+ALT+C")
        
        # Get clipboard content
        text = self.clipboard.get_clipboard_text()
        if not text:
            logger.warning(f"{icons.WARNING} No text content to capture")
            return
        
        self.stats['captures'] += 1
        logger.info(f"{icons.CLIPBOARD} Captured text ({len(text)} characters): {text[:100]}...")
        
        # Insert into database
        self._insert_question_with_retry(text)
    
    def _on_stop_hotkey_pressed(self):
        """Handle stop hotkey press event"""
        logger.info(f"{icons.STOP} Stop hotkey pressed: CTRL+SHIFT+Q")
        logger.info(f"{icons.STOP} Initiating graceful shutdown...")
        self.stop(shutdown=True)
        # Signal the guardian to stop as well
        if hasattr(self, '_guardian_ref'):
            self._guardian_ref.should_run = False
    
    def _insert_question_with_retry(self, question: str):
        """Insert question with automatic retry on connection failure"""
        question_id = self.db.insert_question(question)
        
        if question_id:
            self.stats['successful_inserts'] += 1
            logger.info(f"{icons.SUCCESS} Successfully captured and stored question #{question_id}")
        else:
            # Try to reconnect and retry once
            logger.warning(f"{icons.REFRESH} Attempting to reconnect and retry...")
            if self.db.reconnect_with_backoff():
                question_id = self.db.insert_question(question)
                if question_id:
                    self.stats['successful_inserts'] += 1
                    logger.info(f"{icons.SUCCESS} Successfully captured and stored question #{question_id} after reconnection")
                else:
                    self.stats['failed_inserts'] += 1
                    logger.error(f"{icons.ERROR} Failed to store question even after reconnection")
            else:
                self.stats['failed_inserts'] += 1
                logger.error(f"{icons.ERROR} Failed to store question - no database connection")
    
    def stop(self, shutdown=False):
        """Stop the service"""
        logger.info(f"{icons.STOP} Stopping Clipboard Capture Service...")
        
        self.is_running = False
        if shutdown:
            self.should_restart = False
        
        # Unregister hotkey
        try:
            keyboard.unhook_all_hotkeys()
            logger.info(f"{icons.KEYBOARD} Hotkeys unregistered")
        except Exception as e:
            logger.warning(f"{icons.WARNING} Error unregistering hotkeys: {e}")
        
        # Close database connection
        self.db.close()
        
        # Print statistics only on shutdown
        if shutdown and self.stats['start_time']:
            runtime = time.time() - self.stats['start_time']
            logger.info(f"{icons.STATS} Final Service Statistics:")
            logger.info(f"  Total runtime: {runtime:.1f} seconds")
            logger.info(f"  Restart count: {self.stats['restart_count']}")
            logger.info(f"  Total captures: {self.stats['captures']}")
            logger.info(f"  Successful inserts: {self.stats['successful_inserts']}")
            logger.info(f"  Failed inserts: {self.stats['failed_inserts']}")
        
        if shutdown:
            logger.info(f"{icons.SUCCESS} Clipboard Capture Service stopped")
    
    def run_forever(self):
        """Run the service until interrupted"""
        try:
            while self.is_running:
                time.sleep(1)
                # Health check - verify hotkeys are still registered
                if self.is_running and not keyboard._hotkeys:
                    logger.warning(f"{icons.WARNING} Hotkeys appear to be unregistered, attempting to re-register...")
                    try:
                        keyboard.add_hotkey('ctrl+alt+c', self._on_hotkey_pressed)
                        keyboard.add_hotkey('ctrl+shift+q', self._on_stop_hotkey_pressed)
                        logger.info(f"{icons.SUCCESS} Hotkeys re-registered successfully")
                    except Exception as e:
                        logger.error(f"{icons.ERROR} Failed to re-register hotkeys: {e}")
                        raise Exception("Hotkey registration failed")
        except KeyboardInterrupt:
            logger.info(f"\n{icons.STOP} Received interrupt signal")
            self.stop(shutdown=True)
        except Exception as e:
            logger.error(f"{icons.ERROR} Service error: {e}")
            self.stop()
            raise


class ServiceGuardian:
    """Guardian class that manages service lifecycle and automatic restarts"""
    
    def __init__(self):
        self.service = None
        self.should_run = True
        self.restart_delay = 5  # seconds
        self.max_restart_delay = 60  # max 1 minute
        
    def run(self):
        """Main guardian loop that manages the service"""
        logger.info(f"{icons.SHIELD} Service Guardian started")
        logger.info("Service will automatically restart if it dies")
        logger.info("Use CTRL+SHIFT+Q to stop the service completely")
        
        while self.should_run:
            try:
                self.service = ClipboardService()
                # Pass guardian reference to service for stop hotkey
                self.service._guardian_ref = self
                
                # Attempt to start the service
                if self.service.start():
                    logger.info(f"{icons.SUCCESS} Service started successfully")
                    self.restart_delay = 5  # Reset restart delay on successful start
                    
                    # Run the service
                    self.service.run_forever()
                    
                    # If we get here, service stopped normally
                    if not self.should_run:
                        break
                        
                else:
                    logger.error(f"{icons.ERROR} Failed to start service")
                
                # Service died, restart if we should
                if self.should_run and self.service.should_restart:
                    self.service.stats['restart_count'] += 1
                    logger.warning(f"{icons.RESTART} Service died, restarting in {self.restart_delay} seconds... (restart #{self.service.stats['restart_count']})")
                    time.sleep(self.restart_delay)
                    
                    # Increase restart delay for next time (exponential backoff)
                    self.restart_delay = min(self.restart_delay * 1.5, self.max_restart_delay)
                    
                elif not self.service.should_restart:
                    logger.info(f"{icons.STOP} Service stopped, not restarting")
                    break
                    
            except KeyboardInterrupt:
                logger.info(f"\n{icons.STOP} Guardian received interrupt signal")
                self.should_run = False
                if self.service:
                    self.service.stop(shutdown=True)
                break
                
            except Exception as e:
                logger.error(f"{icons.BOOM} Unexpected guardian error: {e}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                
                if self.should_run:
                    if self.service:
                        self.service.stats['restart_count'] += 1
                    logger.warning(f"{icons.RESTART} Restarting service in {self.restart_delay} seconds due to error...")
                    time.sleep(self.restart_delay)
                    self.restart_delay = min(self.restart_delay * 1.5, self.max_restart_delay)
                else:
                    break
        
        logger.info(f"{icons.SHIELD} Service Guardian stopped")


def signal_handler(signum, frame):
    """Handle system signals for graceful shutdown"""
    logger.info(f"\n{icons.STOP} Received signal {signum}")
    sys.exit(0)


def main():
    """Main entry point"""
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info(f"{icons.TARGET} Clipboard-to-TTS Windows Client v2.0 (Auto-Restart)")
    logger.info("=" * 60)
    
    # Check if running as administrator (required for global hotkeys)
    try:
        import ctypes
        is_admin = ctypes.windll.shell32.IsUserAnAdmin()
        if not is_admin:
            logger.warning(f"{icons.WARNING} Not running as administrator. Hotkeys may not work globally.")
            logger.info("Consider running as administrator for better hotkey reliability.")
    except:
        logger.warning(f"{icons.WARNING} Could not check administrator status")
    
    # Create and start guardian
    guardian = ServiceGuardian()
    guardian.run()


if __name__ == "__main__":
    main() 