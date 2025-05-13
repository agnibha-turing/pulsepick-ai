# PulsePick Backend

The PulsePick AI backend is a FastAPI application that powers content discovery, article processing, and personalized message generation for sales professionals.

## Features

- 🔍 **Content Discovery**: Automatic fetching from Google News and NewsAPI
- 🧠 **AI Processing**: Summarization, categorization, and keyword extraction
- 🔎 **Semantic Search**: Vector embeddings for content similarity
- 📝 **Message Generation**: AI-powered personalized messages for multiple platforms
- 🔄 **Scheduled Updates**: Continuous content refresh using Celery workers

## Core Endpoints

### Articles API

- `GET /api/articles/`: Fetch articles with filtering and sorting
- `GET /api/articles/search`: Semantic search across article content
- `POST /api/articles/fetch`: Manually trigger content fetching

### Messages API

- `POST /api/messages/generate`: Generate personalized messages for selected articles
  - Supports multiple platforms (Email, LinkedIn, Twitter, Slack)
  - Accepts persona details for personalization
  - Implements caching for performance optimization

## Message Generation

The message generation system features:

- **Platform-Specific Formatting**: Tailored messages for Email, LinkedIn, Twitter, and Slack
- **Persona-Aware Content**: Adapts tone and content based on recipient details
- **Contextual References**: Incorporates previous conversation context
- **Personality Adaptation**: Adjusts messaging style based on personality traits
- **Efficient Caching**: TTL-based caching system to reduce API costs and improve performance

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with pgvector extension
- **ORM**: SQLAlchemy
- **AI Integration**: OpenAI API
- **Task Queue**: Celery with Redis
- **Authentication**: JWT (planned)

## Development Setup

### Prerequisites

- Python 3.9+
- PostgreSQL with pgvector extension
- Redis

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Running the Application

```bash
# Run migrations
python run_migrations.py

# Start the API server
uvicorn app.main:app --reload

# In a separate terminal, start the Celery worker
celery -A app.workers.celery_app worker --loglevel=info

# Start the Celery beat scheduler (optional, for scheduled tasks)
celery -A app.workers.celery_app beat --loglevel=info
```

## API Documentation

When running locally, access the auto-generated docs at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Message Generation Prompt Engineering

The backend implements sophisticated prompt engineering for generating personalized messages:

1. **Base Content Structure**:

   - Article summaries and metadata
   - Platform-specific formatting (Email, LinkedIn, Twitter, Slack)

2. **Persona Incorporation**:

   - Name, job title, and company integration
   - Previous conversation context references
   - Personality trait-based tone adjustments

3. **Platform-Specific Optimization**:
   - Email: Professional format with subject line, greeting, and signature
   - LinkedIn: Professional tone with relevant hashtags
   - Twitter: Concise messaging with character limits
   - Slack: Casual formatting with rich text elements

## Extending the Platform

### Adding New Message Platforms

1. Update the `construct_prompt` function in `messages.py`
2. Add platform-specific instructions
3. Update type definitions

### Enhancing Personalization

1. Expand the `Persona` model in `messages.py`
2. Update the prompt engineering logic in `construct_prompt`

## Docker Deployment

```bash
# Build and start services
docker-compose up -d

# Run migrations
docker-compose exec backend python run_migrations.py

# Manually trigger article fetch
docker-compose exec backend python -c "from app.workers.tasks import fetch_articles; fetch_articles()"
```
