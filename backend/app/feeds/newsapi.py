import requests
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.feeds.base import BaseConnector
from app.db.models import SourceType
from app.core.config import settings


class NewsAPIConnector(BaseConnector):
    """Connector for NewsAPI.org"""

    BASE_URL = "https://newsapi.org/v2/everything"

    def __init__(self, db: Session, topics: List[str] = None):
        super().__init__(db, SourceType.NEWS_API)
        self.topics = topics or [
            # General AI topics
            "artificial intelligence", "generative ai", "ai technology",
            # BFSI-specific topics
            "ai banking", "fintech ai", "AI financial services", "insurtech",
            "AI banking innovation", "AI finance applications",
            # Retail-specific topics
            "ai retail", "retail technology ai", "ecommerce ai",
            "ai shopping innovation", "retail automation ai",
            # Healthcare-specific topics
            "healthcare ai", "medical ai innovation", "ai patient care",
            "ai diagnostics", "telemedicine ai"
        ]
        self.api_key = settings.NEWSAPI_KEY

    def _parse_datetime(self, date_str: str) -> Optional[datetime]:
        """Parse the datetime from NewsAPI response"""
        try:
            # Ensure we return a timezone-aware datetime
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            # Double check it has timezone info
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception as e:
            print(f"Error parsing datetime '{date_str}': {e}")
            return None

    def fetch_articles(self, since: Optional[datetime] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch articles from NewsAPI based on configured topics"""
        results = []

        # Ensure since has timezone info if provided
        if since and since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

        # Format the 'from' parameter for NewsAPI - use UTC date
        # Look back 30 days instead of using since parameter to ensure we get results
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        from_param = thirty_days_ago.strftime("%Y-%m-%d")
        print(f"[DEBUG] NewsAPI looking for articles since: {from_param}")

        for topic in self.topics:
            # Create or get source for this topic
            source = self.get_or_create_source(
                name=f"NewsAPI - {topic}",
                description=f"NewsAPI feed for topic: {topic}"
            )

            # Prepare request parameters
            params = {
                'q': topic,
                'sortBy': 'publishedAt',
                'pageSize': min(limit, 100),  # NewsAPI's max pageSize is 100
                'language': 'en',
                'apiKey': self.api_key
            }

            if from_param:
                params['from'] = from_param

            try:
                # Make the API request
                print(
                    f"[DEBUG] Querying NewsAPI for topic: '{topic}' with params: {params}")
                response = requests.get(self.BASE_URL, params=params)
                response.raise_for_status()  # Raise exception for 4XX/5XX responses
                data = response.json()
                print(
                    f"[DEBUG] NewsAPI returned {len(data.get('articles', []))} articles for topic '{topic}', total results: {data.get('totalResults', 0)}")

                # Process articles
                for article in data.get('articles', []):
                    published_at = self._parse_datetime(
                        article.get('publishedAt', ''))

                    # Skip if we couldn't parse the datetime or it's None
                    if not published_at:
                        continue

                    # Ensure timezone info is present
                    if published_at.tzinfo is None:
                        published_at = published_at.replace(
                            tzinfo=timezone.utc)

                    # Skip if older than 'since' parameter (with proper timezone handling)
                    if since:
                        # Ensure since has timezone info
                        since_aware = since if since.tzinfo else since.replace(
                            tzinfo=timezone.utc)
                        if published_at < since_aware:
                            continue

                    # Extract data
                    article_data = {
                        'source_id': source.id,
                        'title': article.get('title', ''),
                        'url': article.get('url', ''),
                        'author': article.get('author', ''),
                        'published_at': published_at,
                        'content': article.get('content', '') or article.get('description', ''),
                        'raw_json': article
                    }

                    results.append(article_data)

                    # Stop if we've reached the limit
                    if len(results) >= limit:
                        break

            except Exception as e:
                # Log error but continue with other topics
                print(
                    f"[ERROR] Error fetching from NewsAPI for topic '{topic}': {e}")
                # Print full exception details for debugging
                import traceback
                print(traceback.format_exc())
                continue

        return results[:limit]
