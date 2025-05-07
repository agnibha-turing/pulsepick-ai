# PulsePick AI

PulsePick AI is an intelligent content curation platform designed for sales professionals, providing personalized, industry-specific content recommendations to help stay informed about market trends and opportunities.

## Project Overview

PulsePick AI uses advanced filtering and recommendation algorithms to deliver relevant content across various industries including BFSI, Retail, Tech, and Healthcare. The platform offers different content types such as articles, social posts, newsletters, and reports, with customizable relevance settings.

![PulsePick AI Screenshot](frontend/public/screenshot.png)

## Features

- **Industry-Specific Content**: Filter content by industry sectors (BFSI, Retail, Tech, Healthcare)
- **Multiple Content Types**: Access articles, social posts, newsletters, and reports
- **Customizable Time Periods**: View content from today, last 7 days, last 30 days, or custom ranges
- **Relevance Controls**: Adjust minimum relevance thresholds for content recommendations
- **Responsive Design**: Fully responsive UI that works on desktop and mobile devices
- **Dark/Light Mode**: Toggle between dark and light themes

## Project Structure

The project is organized into two main directories:

- `frontend/`: React-based web application built with Vite, TypeScript, and shadcn/ui
- `backend/`: (In development) Will contain the API services for content retrieval and user management

## Technology Stack

### Frontend
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Routing**: React Router

## Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the frontend directory
cd pulsepick-ai/frontend

# Install dependencies
npm install
# or
bun install

# Start the development server
npm run dev
# or
bun run dev
```

The application will be available at `http://localhost:5173`.

## Development Roadmap

- **Backend Implementation**: Develop a robust API for content retrieval and user management
- **Authentication**: Add user authentication and profile management
- **Saved Content**: Implement functionality to save and organize favorite content
- **AI Recommendations**: Enhance content recommendations with machine learning algorithms
- **Content Analytics**: Add analytics to track reading patterns and interests

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
