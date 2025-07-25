#!/bin/bash

# Quick Database Reset Script for Clipboard-to-TTS System
# This is a simplified version that quickly resets the database
#
# Usage: ./quick_reset_db.sh
# 
# This script will:
# 1. Stop application services
# 2. Drop and recreate the database
# 3. Apply the initialization script
# 4. Restart services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_color() {
    echo -e "${1}${2}${NC}"
}

print_color $CYAN "🗄️ Quick Database Reset for Clipboard-to-TTS System"
print_color $CYAN "================================================="

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    print_color $RED "❌ Error: .env file not found!"
    exit 1
fi

# Confirm reset
print_color $YELLOW "⚠️ This will destroy all database data. Continue? (y/N)"
read -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_color $YELLOW "Reset cancelled."
    exit 0
fi

# Get database config
DB_NAME=${DB_NAME:-clipboard_tts}
DB_USER=${DB_USER:-postgres}

print_color $YELLOW "🛑 Stopping application services..."
docker-compose stop web-app ai-service tts-service 2>/dev/null || true

print_color $YELLOW "🗄️ Resetting database '$DB_NAME'..."
docker-compose exec -T postgres psql -U "$DB_USER" -d postgres << EOF
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$DB_NAME";
CREATE DATABASE "$DB_NAME" OWNER "$DB_USER";
EOF

print_color $YELLOW "📋 Applying schema..."
docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < database/init/01-init.sql

print_color $YELLOW "🚀 Restarting services..."
docker-compose up -d

print_color $GREEN "✅ Database reset complete!"
print_color $CYAN "Access the web interface at: http://localhost:3000" 