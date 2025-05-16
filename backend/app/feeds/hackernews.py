import feedparser
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import urllib.parse
from time import mktime
from sqlalchemy.orm import Session
import re
import requests

from app.feeds.base import BaseConnector
from app.db.models import SourceType


class HackerNewsConnector(BaseConnector):
    """Connector for Y Combinator Hacker News feeds"""

    # Hacker News has different RSS feeds for different types of content
    FEED_URLS = {
        "front_page": "https://news.ycombinator.com/rss",
        "newest": "https://news.ycombinator.com/newest.rss",
        "show": "https://news.ycombinator.com/showrss",
        "ask": "https://news.ycombinator.com/askrss"
    }

    # Optional: Algolia HN Search API for more advanced filtering
    ALGOLIA_API_URL = "https://hn.algolia.com/api/v1/search_by_date"

    def __init__(self, db: Session, feed_types: List[str] = None):
        super().__init__(db, SourceType.HACKERNEWS)
        # If feed types aren't specified, use front page and newest
        self.feed_types = feed_types or ["front_page", "newest"]

    def _parse_datetime(self, date_str: str) -> Optional[datetime]:
        """Parse the datetime from RSS feed entry"""
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(date_str)
            # Ensure timezone-aware
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
        """Extract content from entry, which may be limited in HN's RSS feeds"""
        if 'summary' in entry:
            return entry.summary
        return entry.get('description', '')

    def fetch_articles(self, since: Optional[datetime] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch articles from Hacker News based on configured feed types"""
        results = []

        # For consistency with other connectors
        if since:
            print(f"[DEBUG] Hacker News looking for articles since: {since}")
        else:
            print(
                f"[DEBUG] Hacker News looking for all available articles (no date filter)")

        # Create a single source for Hacker News
        source = self.get_or_create_source(
            name="Y Combinator Hacker News",
            url="https://news.ycombinator.com/",
            description="Y Combinator Hacker News - technology news and discussion"
        )

        # Process each feed type
        for feed_type in self.feed_types:
            if feed_type not in self.FEED_URLS:
                print(
                    f"[WARNING] Skipping unknown Hacker News feed type: {feed_type}")
                continue

            feed_url = self.FEED_URLS[feed_type]
            print(
                f"[DEBUG] Querying Hacker News feed: '{feed_type}' with URL: {feed_url}")

            try:
                feed = feedparser.parse(feed_url)
                print(
                    f"[DEBUG] Hacker News '{feed_type}' returned {len(feed.entries)} entries")
            except Exception as e:
                print(
                    f"[ERROR] Error fetching from Hacker News for feed '{feed_type}': {e}")
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

    def search_by_topic(self, topic: str, since: Optional[datetime] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Optional additional method to search Hacker News by topic using Algolia API
        This can be integrated into fetch_articles if needed for more targeted searches
        """
        results = []

        # Create a single source for Hacker News
        source = self.get_or_create_source(
            name="Y Combinator Hacker News",
            url="https://news.ycombinator.com/",
            description="Y Combinator Hacker News - technology news and discussion"
        )

        # Set up query parameters for Algolia API
        params = {
            'query': topic,
            'tags': 'story',  # Only get stories, not comments
            'hitsPerPage': limit
        }

        try:
            response = requests.get(self.ALGOLIA_API_URL, params=params)
            if response.status_code == 200:
                data = response.json()
                for hit in data.get('hits', []):
                    # Convert timestamp to datetime
                    created_at = datetime.fromtimestamp(
                        hit.get('created_at_i', 0), tz=timezone.utc)

                    # Skip if older than 'since' parameter
                    if since and created_at < since:
                        continue

                    # Skip if no URL (like "Ask HN" posts)
                    if not hit.get('url'):
                        continue

                    # Extract data
                    article = {
                        'source_id': source.id,
                        'title': hit.get('title', ''),
                        'url': hit.get('url', ''),
                        'author': hit.get('author', ''),
                        'published_at': created_at,
                        'content': hit.get('story_text', ''),
                        'raw_json': hit
                    }

                    results.append(article)
            else:
                print(
                    f"[ERROR] Algolia API returned status code {response.status_code}")
        except Exception as e:
            print(f"[ERROR] Error searching Hacker News via Algolia: {e}")
            import traceback
            print(traceback.format_exc())

        return results
