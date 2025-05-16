import os
from typing import Any, List, Optional, Union
from pydantic import PostgresDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "PulsePick AI"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000", "http://localhost:8000"]

    # Database
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_PORT: str = "5432"
    SQLALCHEMY_DATABASE_URI: Optional[PostgresDsn] = None

    @field_validator("SQLALCHEMY_DATABASE_URI", mode="before")
    def assemble_db_connection(cls, v: Optional[str], values) -> Any:
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme="postgresql+psycopg2",
            username=values.data.get("POSTGRES_USER"),
            password=values.data.get("POSTGRES_PASSWORD"),
            host=values.data.get("POSTGRES_SERVER"),
            port=int(values.data.get("POSTGRES_PORT")),
            path=f"{values.data.get('POSTGRES_DB') or ''}",
        )

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_COMPLETION_MODEL: str = "gpt-4.1-nano"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    # Dimensions for text-embedding-3-large
    OPENAI_EMBEDDING_DIMENSIONS: int = 3072

    # NewsAPI
    NEWSAPI_KEY: str

    # LinkedIn
    LINKEDIN_USERNAME: Optional[str] = None
    LINKEDIN_PASSWORD: Optional[str] = None
    LINKEDIN_LI_AT: Optional[str] = None

    # Feed Parameters
    FETCH_INTERVAL_MINUTES: int = 30
    ARTICLE_FETCH_LIMIT: int = 100

    # News source distribution percentages (must add up to 100)
    # These values can be overridden by environment variables
    GOOGLE_NEWS_PERCENTAGE: float = 40.0
    NEWSAPI_PERCENTAGE: float = 0.0
    TECHCRUNCH_PERCENTAGE: float = 30.0
    HACKERNEWS_PERCENTAGE: float = 30.0

    @model_validator(mode="after")
    def validate_source_percentages_sum(self):
        """Validate that all news source percentages sum to 100%"""
        source_percentages = [
            self.GOOGLE_NEWS_PERCENTAGE,
            self.NEWSAPI_PERCENTAGE,
            self.TECHCRUNCH_PERCENTAGE,
            self.HACKERNEWS_PERCENTAGE
        ]

        # Check if individual percentages are between 0 and 100
        source_names = ["Google News", "NewsAPI", "TechCrunch", "Hacker News"]
        for name, percentage in zip(source_names, source_percentages):
            if percentage < 0 or percentage > 100:
                raise ValueError(
                    f"{name} percentage must be between 0 and 100")

        # Check if they sum to 100
        total = sum(source_percentages)
        if not (99.5 <= total <= 100.5):  # Allow small floating point imprecision
            raise ValueError(
                f"News source percentages must sum to 100%, current sum is {total}%. "
                f"Values: Google News={source_percentages[0]}%, "
                f"NewsAPI={source_percentages[1]}%, "
                f"TechCrunch={source_percentages[2]}%, "
                f"Hacker News={source_percentages[3]}%"
            )

        return self

    # Redis settings - use the same host as CELERY_BROKER_URL for consistency
    @property
    def REDIS_URL(self) -> str:
        # Extract host from CELERY_BROKER_URL to ensure they're the same
        # This handles both local dev (localhost) and Docker (redis service name)
        return self.CELERY_BROKER_URL

    # Look for .env in parent directory (project root) when running locally
    # When in Docker, environment variables are passed directly
    model_config = SettingsConfigDict(
        env_file="../.env" if os.path.exists("../.env") else ".env",
        case_sensitive=True
    )


settings = Settings()
