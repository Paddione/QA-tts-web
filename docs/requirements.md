# Requirements Document

## Introduction

This feature implements a comprehensive clipboard-to-TTS system that captures clipboard content via hotkey, processes it through AI to generate answers, converts answers to speech, and provides a web interface for playback. The system consists of a Windows client application, PostgreSQL database, AI processing service, and web application, all orchestrated through Docker Compose.

## Requirements

### Requirement 1

**User Story:** As a user, I want to capture clipboard content with a hotkey so that I can quickly save questions without interrupting my workflow.

#### Acceptance Criteria

1. WHEN the user presses CTRL+ALT+C THEN the system SHALL capture the current clipboard text as a question
2. WHEN clipboard content is captured THEN the system SHALL automatically create a new database record with auto-generated ID
3. WHEN a new record is created THEN the system SHALL leave answer and mp3path fields empty initially
4. WHEN the Windows client starts THEN it SHALL run invisibly in the background
5. WHEN the Windows client is running THEN it SHALL remain active and responsive to hotkey presses

### Requirement 2

**User Story:** As a user, I want the system to connect reliably to the database so that my clipboard captures are always saved.

#### Acceptance Criteria

1. WHEN the client attempts database connection THEN it SHALL first try connecting via LAN IP (10.0.0.44)
2. IF LAN connection fails THEN the system SHALL fallback to web domain connection (web.korczewski.de)
3. WHEN database connection is established THEN the system SHALL maintain the connection for subsequent operations
4. IF both connection methods fail THEN the system SHALL log the error and retry periodically

### Requirement 3

**User Story:** As a system administrator, I want a PostgreSQL database with proper schema so that question-answer data is stored reliably.

#### Acceptance Criteria

1. WHEN the system starts THEN PostgreSQL database SHALL be available via Docker Compose
2. WHEN the database initializes THEN it SHALL create a table with columns: id (int), question (string), answer (string), mp3path (string)
3. WHEN records are inserted THEN the id field SHALL auto-increment
4. WHEN the database is accessed THEN it SHALL use credentials from the .env file

### Requirement 4

**User Story:** As a user, I want my questions automatically answered using AI so that I get intelligent responses without manual intervention.

#### Acceptance Criteria

1. WHEN a new database entry appears THEN the AI service SHALL detect it automatically
2. WHEN a question is detected THEN the system SHALL send it to Gemini API using the provided API key and GEM_ID
3. WHEN Gemini responds THEN the system SHALL save the answer to the answer column
4. IF API call fails THEN the system SHALL log the error and retry with exponential backoff

### Requirement 5

**User Story:** As a user, I want answers converted to audio files so that I can listen to responses instead of reading them.

#### Acceptance Criteria

1. WHEN an answer is saved to the database THEN the system SHALL convert it to speech using Google TTS
2. WHEN TTS conversion completes THEN the system SHALL save the MP3 file to public/mp3/ directory
3. WHEN saving the MP3 file THEN it SHALL be named using the record ID (e.g., "123.mp3")
4. WHEN the MP3 file is saved THEN the system SHALL update the mp3path column with the file reference
5. IF TTS conversion fails THEN the system SHALL log the error and mark the record appropriately

### Requirement 6

**User Story:** As a user, I want a web interface to browse and play my question-answer pairs so that I can review and listen to previous interactions.

#### Acceptance Criteria

1. WHEN the web application loads THEN it SHALL display a responsive interface that scales to window size
2. WHEN the interface loads THEN it SHALL show a scrollable list of all record IDs on the left side
3. WHEN a user clicks an ID THEN the system SHALL display the corresponding answer text
4. WHEN an answer is displayed AND an MP3 file exists THEN the system SHALL show an audio player
5. WHEN the audio player is shown THEN it SHALL include volume control, speed control, progress bar, play, pause, and restart buttons
6. WHEN an answer is displayed THEN the system SHALL show a delete button to remove the current record completely
7. WHEN the delete button is clicked THEN the system SHALL remove the record from the database and delete the associated MP3 file
8. WHEN there are many IDs THEN the left panel SHALL be scrollable to accommodate all entries

### Requirement 7

**User Story:** As a system administrator, I want all components orchestrated through Docker Compose so that the entire system can be deployed and managed easily.

#### Acceptance Criteria

1. WHEN docker-compose.yml is executed THEN all system components SHALL start correctly
2. WHEN the system starts THEN it SHALL use environment variables from the .env file
3. WHEN components start THEN they SHALL be able to communicate with each other via Docker networking
4. WHEN the web application starts THEN it SHALL be accessible via the configured web domain
5. WHEN the database starts THEN it SHALL persist data using Docker volumes

### Requirement 8

**User Story:** As a system administrator, I want the web application to run on a specific port so that it can be properly configured with the proxy manager.

#### Acceptance Criteria

1. WHEN the web application starts THEN it SHALL listen on port 3000
2. WHEN the web application is running THEN it SHALL be accessible via localhost:3000 from the host system

### Requirement 9

**User Story:** As a system administrator, I want SSL-enabled external access through Nginx Proxy Manager so that the web application is securely accessible from the internet.

#### Acceptance Criteria

1. WHEN Nginx Proxy Manager is configured THEN it SHALL proxy web.korczewski.de to localhost:3000 (10.0.0.44:3000)
2. WHEN the proxy is active THEN it SHALL provide SSL termination for secure HTTPS access
3. IF database access via web is required THEN Nginx Proxy Manager SHALL also provide proxy configuration for database connections
4. WHEN external users access web.korczewski.de THEN they SHALL be securely routed to the local web application