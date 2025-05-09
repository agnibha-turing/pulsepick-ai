-- Initialize database tables for PulsePick
-- This script will run automatically when PostgreSQL container starts with empty data volume

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Source table
CREATE TABLE IF NOT EXISTS source (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    
    url VARCHAR(2048),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Article table
CREATE TABLE IF NOT EXISTS article (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES source(id) NOT NULL,
    title VARCHAR(512) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    author VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    content TEXT,
    summary TEXT,
    image_url VARCHAR(2048),
    industry VARCHAR(50),
    relevance_score FLOAT DEFAULT 0.0,
    keywords VARCHAR[] DEFAULT NULL,
    embedding VECTOR(3072),
    raw_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_article_url UNIQUE (url)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_article_published_at ON article(published_at);
CREATE INDEX IF NOT EXISTS idx_article_source_id ON article(source_id);
CREATE INDEX IF NOT EXISTS idx_article_industry ON article(industry);
