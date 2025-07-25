-- Enhanced AI Service Database Migration
-- Adds tracking columns for AI service usage and RAG capabilities

-- Add columns to track AI service usage
ALTER TABLE questions_answers 
ADD COLUMN IF NOT EXISTS processed_by VARCHAR(50) DEFAULT 'original',
ADD COLUMN IF NOT EXISTS processing_time INTEGER,
ADD COLUMN IF NOT EXISTS used_rag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rag_sources TEXT[];

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_answers_processed_by ON questions_answers(processed_by);
CREATE INDEX IF NOT EXISTS idx_questions_answers_used_rag ON questions_answers(used_rag);
CREATE INDEX IF NOT EXISTS idx_questions_answers_processing_time ON questions_answers(processing_time);

-- Add comments for documentation
COMMENT ON COLUMN questions_answers.processed_by IS 'AI service used: original, gemini, enhanced, error';
COMMENT ON COLUMN questions_answers.processing_time IS 'Processing time in milliseconds';
COMMENT ON COLUMN questions_answers.used_rag IS 'Whether RAG (Retrieval Augmented Generation) was used';
COMMENT ON COLUMN questions_answers.rag_sources IS 'Array of RAG source document references';

-- Display current table structure
\d questions_answers; 