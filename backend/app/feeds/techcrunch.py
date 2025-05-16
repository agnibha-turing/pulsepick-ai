import feedparser
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import urllib.parse
from time import mktime
from sqlalchemy.orm import Session
import re

from app.feeds.base import BaseConnector
from app.db.models import SourceType


class TechCrunchConnector(BaseConnector):
    """Connector for TechCrunch RSS feeds"""

    BASE_URL = "https://techcrunch.com/feed/"
    CATEGORY_FEEDS = {
        "startups": "https://techcrunch.com/category/startups/feed/",
        "ai": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "venture": "https://techcrunch.com/category/venture/feed/",
        "enterprise": "https://techcrunch.com/category/enterprise/feed/",
        "fintech": "https://techcrunch.com/category/fintech/feed/"
    }

    def __init__(self, db: Session, categories: List[str] = None):
        super().__init__(db, SourceType.TECHCRUNCH)
        # If categories aren't specified, use all available categories
        self.categories = categories or list(self.CATEGORY_FEEDS.keys())

    def _parse_datetime(self, date_str: str) -> Optional[datetime]:
        """Parse the datetime from RSS feed entry"""
        try:
            # Use email.utils for robust RFC 2822 parsing if available
            from email.utils import parsedate_to_datetime

            dt = parsedate_to_datetime(date_str)
            # Ensure timezone-aware (TechCrunch dates should be timezone-aware)
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

    def _extract_content(self, entry: Dict[str, Any]) -> str:
        """Extract full content from entry"""
        # TechCrunch RSS feed typically includes the full content in content:encoded
        if 'content' in entry and len(entry.content) > 0:
            return entry.content[0].value
        # Fall back to summary if content is not available
        return entry.get('summary', '')

    def fetch_articles(self, since: Optional[datetime] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch articles from TechCrunch based on configured categories"""
        results = []

        # For consistency with other connectors
        if since:
            print(f"[DEBUG] TechCrunch looking for articles since: {since}")
        else:
            print(
                f"[DEBUG] TechCrunch looking for all available articles (no date filter)")

        # Create a single source for TechCrunch
        source = self.get_or_create_source(
            name="TechCrunch",
            url="https://techcrunch.com/",
            description="TechCrunch technology news and analysis"
        )

        # Fetch from the main feed first
        try:
            feed = feedparser.parse(self.BASE_URL)
            print(
                f"[DEBUG] TechCrunch main feed returned {len(feed.entries)} entries")

            # Process entries
            for entry in feed.entries[:limit]:
                published_at = self._parse_datetime(entry.get('published'))

                # Ensure timezone-aware for safe comparison later
                if published_at and published_at.tzinfo is None:
                    published_at = published_at.replace(tzinfo=timezone.utc)

                # Skip if older than 'since' parameter
                if since and published_at and published_at < since:
                    continue

                # Extract data
                article = {
                    'source_id': source.id,
                    'title': entry.get('title', ''),
                    'url': entry.get('link', ''),
                    'author': self._extract_author(entry),
                    'published_at': published_at,
                    'content': self._extract_content(entry),
                    'raw_json': dict(entry)
                }

                results.append(article)

        except Exception as e:
            print(f"[ERROR] Error fetching from TechCrunch main feed: {e}")
            import traceback
            print(traceback.format_exc())

        # Fetch from category feeds
        for category in self.categories:
            if category not in self.CATEGORY_FEEDS:
                print(
                    f"[WARNING] Skipping unknown TechCrunch category: {category}")
                continue

            feed_url = self.CATEGORY_FEEDS[category]
            print(
                f"[DEBUG] Querying TechCrunch for category: '{category}' with URL: {feed_url}")

            try:
                feed = feedparser.parse(feed_url)
                print(
                    f"[DEBUG] TechCrunch category '{category}' returned {len(feed.entries)} entries")
            except Exception as e:
                print(
                    f"[ERROR] Error fetching from TechCrunch for category '{category}': {e}")
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

                # Skip duplicates (based on URL)
                if any(article['url'] == entry.get('link', '') for article in results):
                    continue

                # Extract data
                article = {
                    'source_id': source.id,
                    'title': entry.get('title', ''),
                    'url': entry.get('link', ''),
                    'author': self._extract_author(entry),
                    'published_at': published_at,
                    'content': self._extract_content(entry),
                    'raw_json': dict(entry)
                }

                results.append(article)

                # Stop if we've reached the limit
                if len(results) >= limit:
                    break

        return results[:limit]
