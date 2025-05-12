from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.db.models import Source, Article, SourceType


class BaseConnector(ABC):
    """Base class for all feed connectors"""

    def __init__(self, db: Session, source_type: SourceType):
        self.db = db
        self.source_type = source_type

    def get_or_create_source(self, name: str, url: Optional[str] = None, description: Optional[str] = None) -> Source:
        """Get an existing source or create a new one if it doesn't exist"""
        source = self.db.query(Source).filter(
            Source.name == name,
            Source.type == self.source_type
        ).first()

        if not source:
            source = Source(
                name=name,
                type=self.source_type,
                url=url,
                description=description
            )
            self.db.add(source)
            self.db.commit()
            self.db.refresh(source)

        return source

    @abstractmethod
    def fetch_articles(self, since: Optional[datetime] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch articles from the source

        Args:
            since: Optional datetime to fetch articles published after this time
            limit: Maximum number of articles to fetch

        Returns:
            List of article dictionaries with at least these fields:
            - title: str
            - url: str
            - published_at: Optional[datetime]
            - content: Optional[str]
            - author: Optional[str]
        """
        pass

    def fetch_since(self, days: int = 1, limit: int = 100) -> List[Dict[str, Any]]:
        """Helper method to fetch articles published in the last N days"""
        # Create timezone-aware UTC datetime to avoid comparison issues with timezone-aware dates
        since = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=days)
        return self.fetch_articles(since=since, limit=limit)
