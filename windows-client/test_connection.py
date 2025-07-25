#!/usr/bin/env python3
"""
Database Connection Test for Windows Clipboard Capture Client

Run this script to test your database configuration before starting the main service.
"""

import os
import sys
import platform
from typing import Optional

# Set up UTF-8 encoding for Windows console
if platform.system() == "Windows":
    try:
        import codecs
        os.system('chcp 65001 >nul 2>&1')
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        else:
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)
    except Exception:
        pass

try:
    import psycopg2
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing required package: {e}")
    print("Please install required packages:")
    print("pip install psycopg2-binary python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Define icons with ASCII fallbacks
class Icons:
    def __init__(self):
        self.use_emojis = self._can_use_emojis()
        if self.use_emojis:
            self.SUCCESS = "✅"
            self.ERROR = "❌"
            self.WARNING = "⚠️"
            self.INFO = "ℹ️"
            self.REFRESH = "🔄"
        else:
            self.SUCCESS = "[OK]"
            self.ERROR = "[ERROR]"
            self.WARNING = "[WARN]"
            self.INFO = "[INFO]"
            self.REFRESH = "[RETRY]"
    
    def _can_use_emojis(self):
        try:
            test_emoji = "🎯"
            test_emoji.encode(sys.stdout.encoding or 'ascii')
            return True
        except (UnicodeEncodeError, AttributeError):
            return False

icons = Icons()

def get_connection_params():
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
    
    return [("LAN IP", lan_params), ("Database Domain", db_params)]

def test_connection(name: str, params: dict) -> bool:
    """Test a single database connection"""
    print(f"{icons.REFRESH} Testing {name} connection to {params['host']}:5432...")
    
    try:
        connection = psycopg2.connect(**params)
        connection.autocommit = True
        
        # Test the connection with a simple query
        with connection.cursor() as cursor:
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            print(f"{icons.SUCCESS} Connected to {name}: {params['host']}")
            print(f"    Database: {params['database']}")
            print(f"    User: {params['user']}")
            print(f"    PostgreSQL: {version.split(',')[0]}")
        
        connection.close()
        return True
        
    except psycopg2.Error as e:
        print(f"{icons.ERROR} {name} connection failed: {e}")
        return False
    except Exception as e:
        print(f"{icons.ERROR} Unexpected error testing {name}: {e}")
        return False

def check_environment():
    """Check environment configuration"""
    print(f"{icons.INFO} Environment Configuration:")
    
    required_vars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'LAN_IP', 'DB_DOMAIN', 'DB_PORT']
    missing_vars = []
    
    for var in required_vars:
        value = os.getenv(var)
        if value:
            if var == 'DB_PASSWORD':
                print(f"    {var}: {'*' * len(value)}")
            else:
                print(f"    {var}: {value}")
        else:
            print(f"    {var}: {icons.WARNING} NOT SET")
            missing_vars.append(var)
    
    if missing_vars:
        print(f"\n{icons.WARNING} Missing environment variables: {', '.join(missing_vars)}")
        print(f"{icons.INFO} Please create a .env file with your configuration")
        print(f"    Copy env.example to .env and update with your values")
        return False
    
    return True

def main():
    """Main test function"""
    print("=" * 60)
    print(f"{icons.INFO} Database Connection Test for Clipboard Capture Client")
    print("=" * 60)
    
    # Check if .env file exists
    if not os.path.exists('.env'):
        print(f"{icons.WARNING} No .env file found!")
        print(f"{icons.INFO} Please copy env.example to .env and configure it:")
        print("    copy env.example .env")
        print("    # Then edit .env with your database settings")
        return False
    
    # Check environment configuration
    if not check_environment():
        return False
    
    print(f"\n{icons.INFO} Testing database connections...")
    
    # Test both connection types
    connection_params = get_connection_params()
    success_count = 0
    
    for name, params in connection_params:
        if test_connection(name, params):
            success_count += 1
        print()  # Empty line for readability
    
    # Summary
    print("=" * 60)
    if success_count > 0:
        print(f"{icons.SUCCESS} Connection test completed: {success_count}/2 connections successful")
        print(f"{icons.INFO} You can now run the clipboard capture service:")
        print("    python clipboard_capture.py")
    else:
        print(f"{icons.ERROR} All connection attempts failed")
        print(f"{icons.INFO} Please check your .env configuration and network connectivity")
    
    print("=" * 60)
    return success_count > 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 