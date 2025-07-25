#!/bin/bash

# Clipboard-to-TTS System Rebuild Script
# Interactive script to rebuild and restart specific services
#
# Usage: ./rebuild.sh
# 
# Features:
# - Rebuild individual services (web-app, ai-service, tts-service)
# - Restart infrastructure services (postgres, nginx-proxy-manager)
# - Rebuild service combinations (web+ai, web+tts, ai+tts, all apps)
# - Complete system rebuild
# - Docker cleanup utilities
# - Service log viewing
# - Container status monitoring
# - Pre-flight checks and safety validations

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
GEAR="⚙️"
CHECK="✅"
WARNING="⚠️"
STOP="🛑"
BUILD="🔨"
RESTART="🔄"
DATABASE="🗄️"
WEB="🌐"
AI="🤖"
AUDIO="🎵"
PROXY="🌍"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_header() {
    echo
    print_color $CYAN "================================================================="
    print_color $CYAN " $ROCKET Clipboard-to-TTS System Rebuild Script $ROCKET"
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
        print_color $WARNING "${WARNING} Warning: .env file not found!"
        print_color $YELLOW "Make sure to create .env file from .env.example"
        echo
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_color $RED "Aborted."
            exit 1
        fi
    fi
}

# Function to show current container status
show_status() {
    print_section "${GEAR} Current Container Status"
    docker-compose ps
    echo
}

# Function to rebuild web-app only
rebuild_web_app() {
    print_section "${WEB} Rebuilding Web Application"
    
    print_color $YELLOW "Stopping web-app container..."
    docker-compose stop web-app
    
    print_color $YELLOW "Removing web-app container..."
    docker-compose rm -f web-app
    
    print_color $YELLOW "Rebuilding web-app image..."
    docker-compose build --no-cache web-app
    
    print_color $YELLOW "Starting web-app container..."
    docker-compose up -d web-app
    
    print_color $GREEN "${CHECK} Web application rebuilt successfully!"
}

# Function to rebuild AI service
rebuild_ai_service() {
    print_section "${AI} Rebuilding AI Service"
    
    print_color $YELLOW "Stopping ai-service container..."
    docker-compose stop ai-service
    
    print_color $YELLOW "Removing ai-service container..."
    docker-compose rm -f ai-service
    
    print_color $YELLOW "Rebuilding ai-service image..."
    docker-compose build --no-cache ai-service
    
    print_color $YELLOW "Starting ai-service container..."
    docker-compose up -d ai-service
    
    print_color $GREEN "${CHECK} AI service rebuilt successfully!"
}

# Function to rebuild TTS service
rebuild_tts_service() {
    print_section "${AUDIO} Rebuilding TTS Service"
    
    print_color $YELLOW "Stopping tts-service container..."
    docker-compose stop tts-service
    
    print_color $YELLOW "Removing tts-service container..."
    docker-compose rm -f tts-service
    
    print_color $YELLOW "Rebuilding tts-service image..."
    docker-compose build --no-cache tts-service
    
    print_color $YELLOW "Starting tts-service container..."
    docker-compose up -d tts-service
    
    print_color $GREEN "${CHECK} TTS service rebuilt successfully!"
}

# Function to restart PostgreSQL
restart_postgres() {
    print_section "${DATABASE} Restarting PostgreSQL"
    
    print_color $YELLOW "Restarting postgres container..."
    docker-compose restart postgres
    
    # Wait for PostgreSQL to be ready
    print_color $YELLOW "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    print_color $GREEN "${CHECK} PostgreSQL restarted successfully!"
}

# Function to restart Nginx Proxy Manager only
restart_nginx_proxy() {
    print_section "${PROXY} Restarting Nginx Proxy Manager"
    
    print_color $YELLOW "Restarting nginx-proxy-manager container..."
    docker-compose restart nginx-proxy-manager
    
    print_color $GREEN "${CHECK} Nginx Proxy Manager restarted successfully!"
    print_color $CYAN "Admin UI available at: http://localhost:81"
}

# Function to rebuild all application services (excluding postgres and nginx)
rebuild_all_apps() {
    print_section "${BUILD} Rebuilding All Application Services"
    
    print_color $YELLOW "Stopping application services..."
    docker-compose stop web-app ai-service tts-service
    
    print_color $YELLOW "Removing application containers..."
    docker-compose rm -f web-app ai-service tts-service
    
    print_color $YELLOW "Rebuilding all application images..."
    docker-compose build --no-cache web-app ai-service tts-service
    
    print_color $YELLOW "Starting application services..."
    docker-compose up -d web-app ai-service tts-service
    
    print_color $GREEN "${CHECK} All application services rebuilt successfully!"
}

# Function to rebuild everything
rebuild_everything() {
    print_section "${BUILD} Complete System Rebuild"
    
    print_color $YELLOW "Stopping all services..."
    docker-compose down
    
    print_color $YELLOW "Rebuilding all application images..."
    docker-compose build --no-cache web-app ai-service tts-service
    
    print_color $YELLOW "Starting all services..."
    docker-compose up -d
    
    print_color $GREEN "${CHECK} Complete system rebuild completed!"
}

# Function to clean up Docker resources
cleanup_docker() {
    print_section "${GEAR} Docker Cleanup"
    
    print_color $YELLOW "Removing unused Docker images..."
    docker image prune -f
    
    print_color $YELLOW "Removing unused Docker containers..."
    docker container prune -f
    
    print_color $YELLOW "Removing unused Docker networks..."
    docker network prune -f
    
    print_color $GREEN "${CHECK} Docker cleanup completed!"
}

# Function to show logs for a specific service
show_logs() {
    local service=$1
    print_section "📋 Showing logs for $service"
    print_color $YELLOW "Press Ctrl+C to stop viewing logs"
    echo
    docker-compose logs -f "$service"
}

# Main menu
show_menu() {
    echo
    print_color $PURPLE "Select an option:"
    echo
    print_color $CYAN "  1) ${WEB} Rebuild Web App only"
    print_color $CYAN "  2) ${AI} Rebuild AI Service only" 
    print_color $CYAN "  3) ${AUDIO} Rebuild TTS Service only"
    print_color $CYAN "  4) ${DATABASE} Restart PostgreSQL only"
    print_color $CYAN "  5) ${PROXY} Restart Nginx Proxy Manager only"
    echo
    print_color $YELLOW "  6) ${BUILD} Rebuild Web App + AI Service"
    print_color $YELLOW "  7) ${BUILD} Rebuild Web App + TTS Service"
    print_color $YELLOW "  8) ${BUILD} Rebuild AI + TTS Services"
    print_color $YELLOW "  9) ${BUILD} Rebuild All Application Services (Web + AI + TTS)"
    echo
    print_color $PURPLE " 10) ${RESTART} Complete System Rebuild (Everything)"
    print_color $PURPLE " 11) ${GEAR} Docker Cleanup (Remove unused images/containers)"
    echo
    print_color $BLUE " 12) 📋 Show service logs"
    print_color $BLUE " 13) ${GEAR} Show container status"
    echo
    print_color $RED " 0) Exit"
    echo
}

# Function to handle log viewing
handle_logs() {
    echo
    print_color $PURPLE "Select service to view logs:"
    echo
    print_color $CYAN "  1) Web App"
    print_color $CYAN "  2) AI Service"
    print_color $CYAN "  3) TTS Service"
    print_color $CYAN "  4) PostgreSQL"
    print_color $CYAN "  5) Nginx Proxy Manager"
    print_color $CYAN "  6) All services"
    echo
    read -p "Enter choice [1-6]: " log_choice
    
    case $log_choice in
        1) show_logs "web-app" ;;
        2) show_logs "ai-service" ;;
        3) show_logs "tts-service" ;;
        4) show_logs "postgres" ;;
        5) show_logs "nginx-proxy-manager" ;;
        6) 
            print_section "📋 Showing all service logs"
            print_color $YELLOW "Press Ctrl+C to stop viewing logs"
            echo
            docker-compose logs -f
            ;;
        *) print_color $RED "Invalid choice!" ;;
    esac
}

# Main execution
main() {
    print_header
    
    # Pre-flight checks
    check_docker
    check_env_file
    
    # Show current status
    show_status
    
    while true; do
        show_menu
        read -p "Enter your choice [0-13]: " choice
        
        case $choice in
            1) rebuild_web_app ;;
            2) rebuild_ai_service ;;
            3) rebuild_tts_service ;;
            4) restart_postgres ;;
            5) restart_nginx_proxy ;;
            6) 
                rebuild_web_app
                rebuild_ai_service
                ;;
            7)
                rebuild_web_app
                rebuild_tts_service
                ;;
            8)
                rebuild_ai_service
                rebuild_tts_service
                ;;
            9) rebuild_all_apps ;;
            10) rebuild_everything ;;
            11) cleanup_docker ;;
            12) handle_logs ;;
            13) show_status ;;
            0) 
                print_color $GREEN "${CHECK} Goodbye!"
                exit 0
                ;;
            *)
                print_color $RED "Invalid choice! Please select 0-13."
                ;;
        esac
        
        # Show updated status after operations
        if [[ $choice =~ ^[1-9]$|^1[01]$ ]]; then
            print_section "${CHECK} Updated Container Status"
            docker-compose ps
        fi
        
        echo
        read -p "Press Enter to continue..."
    done
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 