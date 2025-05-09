from enum import Enum
from sqlalchemy import Column, String, Integer, ForeignKey, Text, Float, DateTime, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.db.base_class import Base
from app.core.config import settings


class SourceType(str, Enum):
    GOOGLE_NEWS = "google_news"
    NEWS_API = "news_api"
    LINKEDIN = "linkedin"
    TWITTER = "twitter"


class Industry(str, Enum):
    BFSI = "bfsi"
    RETAIL = "retail"
    HEALTHCARE = "healthcare"
    TECHNOLOGY = "technology"
    OTHER = "other"


class Source(Base):
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    url = Column(String(2048), nullable=True)
    description = Column(Text, nullable=True)

    # Relationship
    articles = relationship("Article", back_populates="source")

    def __repr__(self):
        return f"<Source {self.name}>"


class Article(Base):
    source_id = Column(Integer, ForeignKey("source.id"), nullable=False)
    title = Column(String(512), nullable=False)
    url = Column(String(2048), nullable=False, unique=True)
    author = Column(String(255), nullable=True)
    published_at = Column(DateTime, nullable=True)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    raw_json = Column(JSON, nullable=True)
    image_url = Column(String(2048), nullable=True)

    # Classification
    industry = Column(String(50), nullable=True)
    relevance_score = Column(Float, nullable=True, default=0.0)
    keywords = Column(ARRAY(String), nullable=True)

    # Vector embedding for similarity search
    embedding = Column(
        Vector(settings.OPENAI_EMBEDDING_DIMENSIONS), nullable=True)

    # Relationship
    source = relationship("Source", back_populates="articles")

    # Indices and constraints
    __table_args__ = (
        UniqueConstraint('url', name='unique_article_url'),
    )

    def __repr__(self):
        return f"<Article {self.title[:30]}...>"
