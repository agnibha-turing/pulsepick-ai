# PulsePick AI

PulsePick AI is a tool for sales and marketing professionals to discover and share relevant AI-related content with their clients and prospects.

## Features

- 🔍 Automatic content discovery from Google News and NewsAPI
- 🧠 AI-powered summarization and industry classification (BFSI, Retail, Healthcare, etc.)
- 🔎 Semantic search using vector embeddings (find content similar to your query)
- 📊 Relevance scoring based on recency and topic matching
- 🔄 Scheduled content ingestion with customizable intervals

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Postgres+pgvector, Celery, OpenAI
- **Data Sources**: Google News RSS, NewsAPI.org, LinkedIn (coming soon)
- **Infrastructure**: Docker, Redis

## Getting Started

### Prerequisites

- Docker and Docker Compose
- OpenAI API key
- NewsAPI key (free tier works for development)

### Setup

1. Clone the repository

   ```
   git clone <repository-url>
   cd pulsepick-ai
   ```

2. Create environment files

   ```
   cp backend/.env.example backend/.env
   ```

3. Edit the `.env` file with your API keys

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   NEWSAPI_KEY=your_newsapi_key_here
   ```

4. Start the services

   ```
   docker-compose up -d
   ```

5. Initialize the database

   ```
   docker-compose exec backend alembic upgrade head
   ```

6. The API is now available at http://localhost:8000
   - API docs: http://localhost:8000/docs

### Manually Trigger Content Fetching

```bash
curl -X POST http://localhost:8000/api/v1/articles/fetch
```

## API Usage

### Get Recent Articles

```bash
# Get latest articles
curl http://localhost:8000/api/v1/articles/

# Filter by industry
curl http://localhost:8000/api/v1/articles/?industry=bfsi

# Paginate results
curl http://localhost:8000/api/v1/articles/?limit=10&offset=20

# Sort by relevance
curl http://localhost:8000/api/v1/articles/?sort_by=relevance_score
```

### Search Articles

```bash
# Semantic search
curl http://localhost:8000/api/v1/articles/search?q=generative%20ai%20fintech

# Combine search with industry filter
curl http://localhost:8000/api/v1/articles/search?q=generative%20ai%20fintech&industry=bfsi
```

## Architecture

```
                 ┌─────────────┐      scheduled      ┌────────────────┐
                 │  Celery /   │ ───────────────────>│ Feed Connectors │
                 │  Celery Beat│                     └────────────────┘
                 └─────────────┘                            │
                       ^                                     │ raw articles
                       │                                     ▼
                worker queue                        ┌─────────────────────┐
              (Redis / RabbitMQ)                    │ Processing Pipeline │
                                                    ├─────────────────────┤
                                                    │ 1. Deduplicate      │
                                                    │ 2. Summarise (LLM)  │
                                                    │ 3. Classify (BFSI…) │
                                                    │ 4. Vector Embedding │
                                                    └─────────┬───────────┘
                                                              │
                Postgres + pgvector                           │
        ┌───────────────────────────────────────────────────┐▼────────────────────┐
        │  articles(id, title, url, summary, embeddings, industry)                │
        │  sources(id, name, type)                                                │
        └──────────────────────────────────┬────────────────────────────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │  REST / GraphQL │
                                  │  FastAPI svc    │
                                  └─────────────────┘
                                           │
                                           ▼
                                  React / Next.js UI
```

## Future Development

- ⬆️ LinkedIn integration
- 📣 Twitter/X integration
- 📱 Mobile-friendly web app
- 📤 Email digests
- 🔗 Slack/Teams integration

## License

MIT
