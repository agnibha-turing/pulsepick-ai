# PulsePick AI

PulsePick AI is a tool for sales and marketing professionals to discover, curate, and share relevant AI-related content with their clients and prospects.

## Features

- 🔍 **Content Discovery**: Automatic content discovery from Google News and NewsAPI
- 🧠 **AI-powered Processing**: Summarization, classification, and keyword extraction
- 👤 **Persona Management**: Create recipient personas with personal and professional details
- 🔎 **Content Selection**: Choose single or multiple articles to share with prospects
- ✉️ **Personalized Messaging**: Generate platform-specific content tailored to recipients
- 📊 **Intelligent Ranking**: Content relevance scoring based on multiple factors
- 🔄 **Auto-Refresh**: Articles are fetched every 30 minutes and reranked 5 minutes later

## Key Components

### Persona-Aware Messaging

Create personalized communications by:

- Defining recipient profiles (name, job title, company)
- Setting conversation context for continuity
- Specifying personality traits to adjust tone and style
- Generating platform-specific content (Email, LinkedIn, Twitter, Slack)

### Multi-Platform Content Sharing

Share valuable insights across multiple channels:

- Professional emails with subject lines and formal structure
- LinkedIn posts with industry-relevant hashtags
- Twitter/X posts optimized for character limits
- Slack messages with appropriate formatting

### Smart Content Curation

Efficiently manage your content sharing:

- Select multiple articles simultaneously
- Preview generated messages before sharing
- Regenerate content until it matches your needs
- Copy content directly to clipboard

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
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

6. The application is now available at:

   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API docs: http://localhost:8000/docs

## Content Refresh and Reranking

PulsePick AI keeps your content fresh and relevant through scheduled processes:

- **Article Fetching**: Every 30 minutes, the system automatically fetches new articles from various sources (Google News, NewsAPI, LinkedIn)
- **Content Reranking**: 5 minutes after each fetch, all articles are reranked based on relevance scoring
- **Last Updated Timestamp**: The UI displays when articles were last fetched or reranked in your local timezone
- **Manual Refresh**: Users can manually trigger a refresh at any time using the refresh button

## Component Architecture

```
                            ┌─────────────────────┐
                            │   React Frontend    │
                            │    Components       │
                            ├─────────────────────┤
                            │ - Persona Input     │
                            │ - Article Selection │
                            │ - Message Dialog    │
                            └──────────┬──────────┘
                                       │
                                       ▼
┌───────────────────┐            ┌─────────────┐
│  Context Providers │◄──────────┤  Services   │
│  - Persona         │           │ - Article   │
│  - SelectedArticles│           │ - Message   │
└───────────────────┘            └──────┬──────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────┐
│                     Backend API                       │
├──────────────────────────────────────────────────────┤
│ - Article Endpoints (/api/articles)                  │
│ - Message Generation (/api/messages/generate)        │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────┐
│  Processing Pipeline                                   │
├───────────────────────────────────────────────────────┤
│ - Content Fetching (RSS, NewsAPI)                     │
│ - AI Processing (OpenAI API)                          │
│   - Summarization                                     │
│   - Classification                                    │
│   - Personalized Message Generation                   │
└───────────────────────────────────────────────────────┘
```

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Future Development

- ⬆️ LinkedIn direct posting integration
- 📣 Twitter/X direct posting
- 📱 Mobile application
- 📤 Email digests and scheduling
- 🔗 Slack/Teams direct integration

## License

MIT
