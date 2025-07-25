-- Database initialization script for clipboard-to-TTS system
-- Creates the questions_answers table and notification triggers

-- Create the main table
CREATE TABLE IF NOT EXISTS questions_answers (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    mp3path TEXT, -- Changed from VARCHAR(255) to TEXT to handle longer error messages
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger function for new question notifications
CREATE OR REPLACE FUNCTION notify_new_question()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify AI service about new question
    PERFORM pg_notify('new_question', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for new answer notifications
CREATE OR REPLACE FUNCTION notify_new_answer()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if answer was added (changed from NULL to non-NULL)
    IF OLD.answer IS NULL AND NEW.answer IS NOT NULL THEN
        PERFORM pg_notify('new_answer', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER question_inserted
    AFTER INSERT ON questions_answers
    FOR EACH ROW
    WHEN (NEW.answer IS NULL)
    EXECUTE FUNCTION notify_new_question();

CREATE TRIGGER answer_updated
    AFTER UPDATE ON questions_answers
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_answer();

CREATE TRIGGER update_updated_at
    BEFORE UPDATE ON questions_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_answers_created_at ON questions_answers(created_at);
CREATE INDEX IF NOT EXISTS idx_questions_answers_answer_null ON questions_answers(id) WHERE answer IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_answers_mp3path_null ON questions_answers(id) WHERE mp3path IS NULL;

-- Insert a test record for verification (optional)
-- INSERT INTO questions_answers (question) VALUES ('What is the capital of France?');

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres; 