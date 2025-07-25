# Implementation Plan

- [x] 1. Set up project structure and database foundation
  - Create directory structure for all services (windows-client, ai-service, tts-service, web-app)
  - Create Docker Compose configuration with PostgreSQL service
  - Create database initialization script with schema and triggers
  - Create .env.example file with all required environment variables
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.1, 7.2_

- [x] 2. Implement PostgreSQL database schema and triggers
  - Write SQL schema for questions_answers table with auto-increment ID
  - Implement PostgreSQL trigger functions for new_question and new_answer notifications
  - Create database initialization script that runs on container startup
  - Write database connection utility functions for other services
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 5.1_

- [x] 3. Create Windows client application for clipboard capture
  - Implement hotkey registration for CTRL+ALT+C using Windows API
  - Create clipboard access functionality to capture text content
  - Implement database connection with dual-path logic (LAN IP then web domain fallback)
  - Create background service that runs invisibly and maintains hotkey responsiveness
  - Add error logging and retry logic for database connection failures
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

- [x] 4. Build AI processing service for Gemini integration
  - Create Node.js service that listens for PostgreSQL new_question notifications
  - Implement Gemini API client with proper authentication using API key and GEM_ID
  - Create question processing workflow that fetches questions and generates answers
  - Implement error handling with exponential backoff retry logic for API failures
  - Add database update functionality to save AI responses to answer column
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Develop TTS service for audio generation
  - Create service that listens for PostgreSQL new_answer notifications
  - Implement Google TTS client integration for text-to-speech conversion
  - Create file management system to save MP3 files with ID-based naming (e.g., "123.mp3")
  - Implement database update to save mp3path references after successful file creation
  - Add error handling and logging for TTS conversion failures
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Create web application backend API
  - Set up Express.js server that listens on port 3000
  - Implement REST API endpoints: GET /api/records, GET /api/records/:id, DELETE /api/records/:id
  - Create database connection and query functions for record retrieval
  - Implement record deletion functionality that removes both database entry and MP3 file
  - Add static file serving for MP3 files from public/mp3/ directory
  - _Requirements: 6.3, 6.7, 8.1, 8.2_

- [x] 7. Build responsive web frontend interface
  - Create responsive HTML/CSS layout with left sidebar for IDs and main content area
  - Implement scrollable ID list that displays all record IDs from database
  - Create answer display component that shows selected record's answer text
  - Build custom audio player with volume control, speed control, progress bar, play, pause, and restart buttons
  - Add delete button functionality that calls backend API to remove records
  - Ensure interface scales properly to window size and handles many records
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 8. Configure Docker Compose orchestration
  - Complete docker-compose.yml with all service definitions and networking
  - Configure environment variable usage from .env file across all services
  - Set up Docker volumes for PostgreSQL data persistence and MP3 file sharing
  - Ensure proper service dependencies and startup order
  - Configure internal Docker networking for service communication
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 9. Set up Nginx Proxy Manager configuration
  - Create Nginx proxy manager service in docker-compose.yml
  - Create Nginx proxy configuration for web.korczewski.de to localhost:3000 routing
  - Configure SSL termination with automatic certificate management
  - Cert mail adress is env-Variable ${CERT_MAIL}
  - Set up proxy rules for both web application and database access if needed
  - Test external HTTPS access through the configured domain
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 10. Implement comprehensive error handling and logging
  - Add structured logging to all services with correlation IDs
  - Implement connection retry logic with exponential backoff across all services
  - Create graceful error handling for API failures, file system errors, and network issues
  - Add health check endpoints for all services
  - _Requirements: 2.4, 4.4, 5.5_

- [x] 11. Create automated tests for core functionality
  - Write unit tests for Windows client clipboard capture and database connection
  - Create integration tests for AI service Gemini API integration
  - Implement tests for TTS service file creation and database updates
  - Write API tests for web application endpoints and record management
  - Create end-to-end tests for the complete workflow from clipboard capture to web playback
  - _Requirements: All requirements validation_

- [ ] 12. Finalize deployment and documentation
  - Create comprehensive README with setup and deployment instructions
  - Document environment variable configuration and API key setup
  - Create troubleshooting guide for common connection and deployment issues
  - Test complete system deployment using docker-compose up
  - Verify all components work together in the deployed environment
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_