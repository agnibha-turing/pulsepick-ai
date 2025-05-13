import feedparser
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import urllib.parse
from time import mktime
from sqlalchemy.orm import Session
import re

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
            # Use email.utils for robust RFC 2822 parsing if available
            from email.utils import parsedate_to_datetime

            dt = parsedate_to_datetime(date_str)
            # Ensure timezone-aware (Google News dates are usually GMT)
            if dt and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            try:
                # Fallback to feedparser + mktime then assume UTC
                ts = mktime(feedparser.parsedate(date_str))
                return datetime.fromtimestamp(ts, tz=timezone.utc)
            except Exception:
                return None

    def _extract_author(self, entry: Dict[str, Any]) -> Optional[str]:
        """Extract author from entry if available"""
        if 'author' in entry:
            return entry['author']
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

        # Create a single Google News source for all topics
        source = self.get_or_create_source(
            name="Google News",
            url="https://news.google.com/",
            description="Google News feed for various topics"
        )

        for topic in self.topics:
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

                # Ensure timezone-aware for safe comparison later
                if published_at and published_at.tzinfo is None:
                    published_at = published_at.replace(tzinfo=timezone.utc)

                # Skip if older than 'since' parameter
                if since and published_at and published_at < since:
                    continue

                # Extract more metadata
                author = self._extract_author(entry)

                # Extract data
                article = {
                    'source_id': source.id,
                    'title': entry.get('title', ''),
                    'url': entry.get('link', ''),
                    'author': author,
                    'published_at': published_at,
                    'content': entry.get('summary', ''),
                    'raw_json': dict(entry)
                }

                results.append(article)

                # Stop if we've reached the limit
                if len(results) >= limit:
                    break

        return results[:limit]
