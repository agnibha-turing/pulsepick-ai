import feedparser
from datetime import datetime
from typing import List, Dict, Any, Optional
import urllib.parse
from time import mktime
from sqlalchemy.orm import Session

from app.feeds.base import BaseConnector
from app.db.models import SourceType


class GoogleNewsConnector(BaseConnector):
    """Connector for Google News RSS feeds"""

    BASE_URL = "https://news.google.com/rss/search"

    def __init__(self, db: Session, topics: List[str] = None):
        super().__init__(db, SourceType.GOOGLE_NEWS)
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

    def _build_url(self, query: str) -> str:
        """Build Google News RSS URL for the given query"""
        encoded_query = urllib.parse.quote(query)
        return f"{self.BASE_URL}?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"

    def _parse_datetime(self, date_str: str) -> Optional[datetime]:
        """Parse the datetime from RSS feed entry"""
        try:
            return datetime.fromtimestamp(mktime(feedparser.parsedate(date_str)))
        except:
            return None

    def fetch_articles(self, since: Optional[datetime] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch articles from Google News based on configured topics"""
        results = []

        # For consistency with NewsAPI logging
        if since:
            print(f"[DEBUG] Google News looking for articles since: {since}")
        else:
            print(
                f"[DEBUG] Google News looking for all available articles (no date filter)")

        for topic in self.topics:
            # Create or get source for this topic
            source = self.get_or_create_source(
                name=f"Google News - {topic}",
                url=self._build_url(topic),
                description=f"Google News feed for topic: {topic}"
            )

            # Fetch the RSS feed
            feed_url = self._build_url(topic)
            print(
                f"[DEBUG] Querying Google News for topic: '{topic}' with URL: {feed_url}")
            try:
                feed = feedparser.parse(feed_url)
                print(
                    f"[DEBUG] Google News returned {len(feed.entries)} entries for topic '{topic}'")
            except Exception as e:
                print(
                    f"[ERROR] Error fetching from Google News for topic '{topic}': {e}")
                import traceback
                print(traceback.format_exc())
                continue

            # Process entries
            for entry in feed.entries[:limit]:
                published_at = self._parse_datetime(entry.get('published'))

                # Skip if older than 'since' parameter
                if since and published_at and published_at < since:
                    continue

                # Extract data
                article = {
                    'source_id': source.id,
                    'title': entry.get('title', ''),
                    'url': entry.get('link', ''),
                    'author': entry.get('author', ''),
                    'published_at': published_at,
                    'content': entry.get('summary', ''),
                    'raw_json': dict(entry)
                }

                results.append(article)

                # Stop if we've reached the limit
                if len(results) >= limit:
                    break

        return results[:limit]
