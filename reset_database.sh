#!/bin/bash

# Database Reset Script for Clipboard-to-TTS System
# This script safely drops and recreates the PostgreSQL database with fresh schema
#
# Usage: ./reset_database.sh
# 
# What this script does:
# 1. Stops application services that depend on the database
# 2. Connects to PostgreSQL and drops the existing database
# 3. Creates a new database with the same name
# 4. Applies the initialization script (01-init.sql)
# 5. Restarts the application services
# 6. Verifies the new database structure

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis for better UX
ROCKET="🚀"
DATABASE="🗄️"
WARNING="⚠️"
CHECK="✅"
STOP="🛑"
BOOM="💥"
REFRESH="🔄"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_header() {
    echo
    print_color $CYAN "================================================================="
    print_color $CYAN " $DATABASE Database Reset Script for Clipboard-to-TTS $DATABASE"
    print_color $CYAN "================================================================="
    echo
}

print_section() {
    echo
    print_color $BLUE "--- $1 ---"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_color $RED "${STOP} Error: Docker is not running!"
        print_color $YELLOW "Please start Docker and try again."
        exit 1
    fi
}

# Function to check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        print_color $RED "${WARNING} Error: .env file not found!"
        print_color $YELLOW "Please create .env file from .env.example with your database configuration."
        exit 1
    fi
}

# Function to load environment variables
load_env() {
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
}

# Function to confirm the destructive action
confirm_reset() {
    print_color $WARNING "WARNING: This will completely destroy the current database and all data!"
    print_color $YELLOW "Database: $DB_NAME"
    print_color $YELLOW "This action cannot be undone."
    echo
    read -p "Are you sure you want to proceed? (type 'YES' to confirm): " confirmation
    
    if [ "$confirmation" != "YES" ]; then
        print_color $YELLOW "Database reset cancelled."
        exit 0
    fi
}

# Function to stop application services
stop_services() {
    print_section "Stopping Application Services"
    
    print_color $YELLOW "Stopping services that depend on the database..."
    
    # Stop application services but keep postgres and nginx running
    docker-compose stop web-app ai-service tts-service 2>/dev/null || true
    
    print_color $GREEN "${CHECK} Application services stopped"
    
    # Wait a moment for connections to close
    print_color $YELLOW "Waiting for connections to close..."
    sleep 5
}

# Function to reset the database
reset_database() {
    print_section "Resetting Database"
    
    # Get database configuration
    DB_NAME=${DB_NAME:-clipboard_tts}
    DB_USER=${DB_USER:-postgres}
    DB_PASSWORD=${DB_PASSWORD:-}
    
    if [ -z "$DB_PASSWORD" ]; then
        print_color $RED "${BOOM} Error: DB_PASSWORD not set in .env file"
        exit 1
    fi
    
    print_color $YELLOW "Database configuration:"
    print_color $YELLOW "  Name: $DB_NAME"
    print_color $YELLOW "  User: $DB_USER"
    
    # Connect to postgres database to drop and recreate our database
    print_color $YELLOW "Dropping existing database '$DB_NAME'..."
    
    docker-compose exec -T postgres psql -U "$DB_USER" -d postgres << EOF
-- Terminate any existing connections to the database
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();

-- Drop the database if it exists
DROP DATABASE IF EXISTS "$DB_NAME";

-- Create the database
CREATE DATABASE "$DB_NAME" OWNER "$DB_USER";
EOF

    if [ $? -eq 0 ]; then
        print_color $GREEN "${CHECK} Database '$DB_NAME' dropped and recreated successfully"
    else
        print_color $RED "${BOOM} Failed to reset database"
        exit 1
    fi
}

# Function to apply initialization script
apply_init_script() {
    print_section "Applying Database Schema"
    
    print_color $YELLOW "Applying initialization script (01-init.sql)..."
    
    # Check if the init script exists
    if [ ! -f "database/init/01-init.sql" ]; then
        print_color $RED "${BOOM} Error: database/init/01-init.sql not found!"
        exit 1
    fi
    
    # Apply the initialization script
    docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < database/init/01-init.sql
    
    if [ $? -eq 0 ]; then
        print_color $GREEN "${CHECK} Database schema applied successfully"
    else
        print_color $RED "${BOOM} Failed to apply database schema"
        exit 1
    fi
}

# Function to verify the database structure
verify_database() {
    print_section "Verifying Database Structure"
    
    print_color $YELLOW "Checking database structure..."
    
    # Verify tables, functions, and triggers exist
    docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Check if main table exists
\dt questions_answers

-- Check if functions exist
\df notify_new_question
\df notify_new_answer
\df update_updated_at_column

-- Check if triggers exist
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN ('question_inserted', 'answer_updated', 'update_updated_at');

-- Check if indexes exist
\di idx_questions_answers_*

-- Show table structure
\d questions_answers

-- Count records (should be 0 for fresh database)
SELECT COUNT(*) as record_count FROM questions_answers;
EOF

    if [ $? -eq 0 ]; then
        print_color $GREEN "${CHECK} Database structure verified successfully"
    else
        print_color $WARNING "${WARNING} Database verification completed with warnings"
    fi
}

# Function to restart services
restart_services() {
    print_section "Restarting Services"
    
    print_color $YELLOW "Starting all application services..."
    
    # Start all services
    docker-compose up -d
    
    # Wait for services to be ready
    print_color $YELLOW "Waiting for services to start..."
    sleep 10
    
    # Check service status
    print_color $YELLOW "Checking service status..."
    docker-compose ps
    
    print_color $GREEN "${CHECK} Services restarted"
}

# Function to test the new database
test_database() {
    print_section "Testing Database Functionality"
    
    print_color $YELLOW "Testing database connectivity and triggers..."
    
    # Insert a test record to verify triggers work
    docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Insert a test question
INSERT INTO questions_answers (question) VALUES ('Test question: What is 2+2?');

-- Check if the record was inserted with proper timestamps
SELECT id, question, created_at, updated_at FROM questions_answers WHERE question LIKE 'Test question:%';

-- Update with an answer to test the answer trigger
UPDATE questions_answers SET answer = 'The answer is 4.' WHERE question LIKE 'Test question:%';

-- Verify the updated_at timestamp changed
SELECT id, question, answer, created_at, updated_at FROM questions_answers WHERE question LIKE 'Test question:%';

-- Clean up test record
DELETE FROM questions_answers WHERE question LIKE 'Test question:%';

-- Confirm cleanup
SELECT COUNT(*) as remaining_test_records FROM questions_answers WHERE question LIKE 'Test question:%';
EOF

    if [ $? -eq 0 ]; then
        print_color $GREEN "${CHECK} Database functionality test passed"
    else
        print_color $WARNING "${WARNING} Database functionality test had issues"
    fi
}

# Function to show final status
show_final_status() {
    print_section "Reset Complete"
    
    print_color $GREEN "${CHECK} Database reset completed successfully!"
    echo
    print_color $CYAN "What was done:"
    print_color $YELLOW "  • Stopped application services safely"
    print_color $YELLOW "  • Dropped and recreated database '$DB_NAME'"
    print_color $YELLOW "  • Applied fresh schema from 01-init.sql"
    print_color $YELLOW "  • Created all tables, functions, triggers, and indexes"
    print_color $YELLOW "  • Restarted all services"
    print_color $YELLOW "  • Verified database functionality"
    echo
    print_color $CYAN "Your database is now ready with a clean slate!"
    print_color $CYAN "Access the web interface at: http://localhost:3000"
    echo
}

# Main execution
main() {
    print_header
    
    # Pre-flight checks
    check_docker
    check_env_file
    load_env
    
    # Confirm the destructive action
    confirm_reset
    
    # Execute the reset process
    stop_services
    reset_database
    apply_init_script
    verify_database
    restart_services
    test_database
    show_final_status
}

# Handle interruption
trap 'print_color $RED "\n${STOP} Script interrupted. You may need to restart services manually: docker-compose up -d"; exit 1' INT TERM

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 