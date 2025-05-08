import requests
from datetime import datetime
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
            "artificial intelligence", "generative ai", "ai technology"]
        self.api_key = settings.NEWSAPI_KEY

    def _parse_datetime(self, date_str: str) -> Optional[datetime]:
        """Parse the datetime from NewsAPI response"""
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except:
            return None

    def fetch_articles(self, since: Optional[datetime] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch articles from NewsAPI based on configured topics"""
        results = []

        # Format the 'from' parameter for NewsAPI
        from_param = since.strftime("%Y-%m-%d") if since else None

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
                response = requests.get(self.BASE_URL, params=params)
                response.raise_for_status()  # Raise exception for 4XX/5XX responses
                data = response.json()

                # Process articles
                for article in data.get('articles', []):
                    published_at = self._parse_datetime(
                        article.get('publishedAt', ''))

                    # Skip if older than 'since' parameter (double-check)
                    if since and published_at and published_at < since:
                        continue

                    # Extract data
                    article_data = {
                        'source_id': source.id,
                        'title': article.get('title', ''),
                        'url': article.get('url', ''),
                        'author': article.get('author', ''),
                        'published_at': published_at,
                        'content': article.get('content', '') or article.get('description', ''),
                        'image_url': article.get('urlToImage', ''),
                        'raw_json': article
                    }

                    results.append(article_data)

                    # Stop if we've reached the limit
                    if len(results) >= limit:
                        break

            except Exception as e:
                # Log error but continue with other topics
                print(f"Error fetching from NewsAPI for topic '{topic}': {e}")
                continue

        return results[:limit]
