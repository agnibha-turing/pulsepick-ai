# LinkedIn Connector Setup

This document explains how to set up and use the LinkedIn connector for fetching articles.

## Prerequisites

The LinkedIn connector requires:

1. A valid LinkedIn account with email and password
2. Python packages:
   - playwright
   - fake-useragent
   - beautifulsoup4
   - python-dateutil

## Configuration

### 1. Environment Variables

Add the following variables to your `.env` file:

```
LINKEDIN_USERNAME=your_linkedin_email
LINKEDIN_PASSWORD=your_linkedin_password
```

### 2. Docker Setup

The LinkedIn connector is already integrated into the Docker setup:

- All necessary dependencies including Playwright and Chromium browser are installed automatically in the Docker containers
- Environment variables are passed from the host to the containers
- The Dockerfile includes all required system dependencies for Playwright

## How It Works

The LinkedIn connector:

1. Uses Playwright to automate a headless Chromium browser with enhanced stealth features
2. Maintains a cookie-based session to reduce login frequency
3. Logs in to LinkedIn using the provided credentials
4. Searches for articles based on industry-specific keywords
5. Uses multiple fallback selectors to handle LinkedIn's frequent UI changes
6. Extracts article details (title, URL, author, date, image, etc.)
7. Processes the articles through the same pipeline as other sources

## Benefits of Playwright Implementation

The Playwright approach offers several advantages over traditional web scrapers:

- Better stealth capabilities to avoid detection
- More reliable handling of modern JavaScript-heavy sites
- Built-in auto-waiting mechanisms for elements to be ready
- Better handling of network conditions and timeouts
- Session persistence through cookies
- Multiple selector fallbacks for resilience against UI changes

## Article Distribution

The system maintains a 50-50 distribution between Google News and LinkedIn:

- Google News fetches 50% of the articles using its RSS feed
- LinkedIn fetches the other 50% using Playwright browser automation
- NewsAPI is currently disabled (commented out)

## Testing

You can manually trigger article fetching using the FastAPI endpoint:

1. Go to http://localhost:8000/docs
2. Find the POST endpoint `/api/v1/articles/fetch`
3. Click "Execute" to trigger the article fetching process
4. Check the logs to see if LinkedIn articles are being fetched

## Troubleshooting

If you encounter issues with the LinkedIn connector:

1. Check your LinkedIn credentials are correct in the environment variables
2. Review the logs for screenshot paths if login fails (saved to /tmp directory)
3. LinkedIn has strong anti-scraping measures that may detect automation
4. If you encounter CAPTCHA or security challenges, screenshots are saved for debugging
5. If login cookies become invalid, they will be regenerated automatically
6. Try reducing the frequency of fetches or the number of articles per fetch if you get blocked

## Security Considerations

Please note:

- Store your LinkedIn credentials securely
- The connector uses advanced stealth techniques like:
  - Random delays between actions
  - Rotating user agents
  - Webdriver detection avoidance
  - Browser fingerprint modification
- LinkedIn's terms of service may have restrictions on automated access
- For production use, consider implementing proxy rotation to further reduce detection risk
