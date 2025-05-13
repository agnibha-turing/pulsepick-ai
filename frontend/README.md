# PulsePick Frontend

PulsePick AI frontend is a modern React application for sales professionals to discover, curate, and share AI-related content with their clients and prospects.

## Features

- 📊 **Industry-specific Content Discovery**: Browse and filter content by industry (BFSI, Retail, Healthcare, etc.)
- 👤 **Persona Management**: Create recipient personas with details like name, job title, company, and personality traits
- 🔍 **Article Selection**: Select individual or multiple articles for sharing
- ✉️ **Personalized Message Generation**: Create customized messages for LinkedIn, Twitter, Email, and Slack
- 📱 **Responsive Design**: Fully mobile-responsive UI for on-the-go content curation
- 🌙 **Dark Mode**: Built-in theme toggle for different lighting conditions

## Core Components

### Persona Input

- Create detailed recipient profiles including:
  - Name and job title
  - Company information
  - Previous conversation context
  - Personality traits for tone customization

### Article Selection

- Select single or multiple articles
- Visual indicators for selected content
- Floating action button for multi-article actions

### Message Generation

- Generate personalized messages for multiple platforms:
  - Email with subject lines and formal structure
  - LinkedIn posts with professional tone and hashtags
  - Twitter/X posts with concise wording
  - Slack messages with casual formatting
- AI-powered message creation that considers:
  - Recipient's role and company
  - Previous conversation context
  - Personality traits and preferences

## Tech Stack

- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Context
- **Notifications**: Sonner toast notifications

## Development Setup

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file with the following:

```
VITE_API_URL=http://localhost:8000/api
```

## API Integration

The frontend communicates with the backend API for:

- Fetching article content
- Generating personalized messages
- Filtering and sorting articles

## Folder Structure

```
src/
├── components/        # UI components
│   ├── article-card.tsx       # Article display and selection
│   ├── message-dialog.tsx     # Message generation dialog
│   ├── persona-input-card.tsx # Persona management component
│   └── generate-message-fab.tsx # Floating action button
├── context/           # React context providers
│   ├── persona-context.tsx    # Recipient persona state
│   └── selected-articles-context.tsx # Article selection state
├── services/          # API services
│   ├── article-service.ts     # Article fetching and filtering
│   └── message-service.ts     # Message generation service
└── pages/             # Application pages
    └── Index.tsx      # Main content discovery page
```

## Extending the Application

Add new platform support by:

1. Adding a new platform option in `message-dialog.tsx`
2. Extending the `message-service.ts` to support the new platform
3. Update the backend prompt template to include platform-specific guidance
