from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging
from celery import group
import os
import asyncio

from app.workers.celery_app import celery_app
from app.db.session import SessionLocal
from app.feeds.google_news import GoogleNewsConnector
from app.feeds.newsapi import NewsAPIConnector
from app.feeds.linkedin import LinkedInConnector
from app.pipeline.processor import ArticleProcessor
from app.core.config import settings


# Configure logging
logger = logging.getLogger(__name__)


@celery_app.task
def fetch_google_news():
    """Fetch articles from Google News RSS and process them"""
    db = SessionLocal()
    try:
        logger.info("Fetching articles from Google News")
        connector = GoogleNewsConnector(db)
        articles = connector.fetch_since(
            days=1, limit=settings.ARTICLE_FETCH_LIMIT // 2)  # Reduced to 50% of total limit

        if articles:
            logger.info(f"Found {len(articles)} new articles from Google News")
            process_articles.delay(articles)
        else:
            logger.info("No new articles found from Google News")

        return len(articles)

    except Exception as e:
        logger.error(f"Error fetching from Google News: {e}")
        return 0

    finally:
        db.close()


@celery_app.task
def fetch_newsapi():
    """Fetch articles from NewsAPI and process them"""
    db = SessionLocal()
    try:
        logger.info("Fetching articles from NewsAPI")
        connector = NewsAPIConnector(db)
        articles = connector.fetch_since(
            days=1, limit=settings.ARTICLE_FETCH_LIMIT)

        if articles:
            logger.info(f"Found {len(articles)} new articles from NewsAPI")
            process_articles.delay(articles)
        else:
            logger.info("No new articles found from NewsAPI")

        return len(articles)

    except Exception as e:
        logger.error(f"Error fetching from NewsAPI: {e}")
        return 0

    finally:
        db.close()


@celery_app.task
def fetch_linkedin():
    """Fetch articles from LinkedIn hashtags and process them"""
    db = SessionLocal()
    try:
        logger.info("Fetching articles from LinkedIn hashtags")

        # Get LinkedIn credentials from environment variables
        linkedin_credentials = {
            "username": os.environ.get("LINKEDIN_USERNAME", ""),
            "password": os.environ.get("LINKEDIN_PASSWORD", "")
        }

        # Check if credentials are available
        if not linkedin_credentials["username"] or not linkedin_credentials["password"]:
            logger.error(
                "LinkedIn credentials not found in environment variables")
            return 0

        connector = LinkedInConnector(db, credentials=linkedin_credentials)

        # Use fetch_since which is compatible with other connectors
        articles = connector.fetch_since(
            days=7,  # Look back 7 days for LinkedIn content
            limit=settings.ARTICLE_FETCH_LIMIT // 2  # 50% of total limit
        )

        if articles:
            logger.info(
                f"Found {len(articles)} new articles from LinkedIn hashtags")
            process_articles.delay(articles)
        else:
            logger.info("No new posts found from LinkedIn hashtags")

        return len(articles)

    except Exception as e:
        logger.error(f"Error fetching from LinkedIn: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0

    finally:
        db.close()


@celery_app.task
def process_articles(articles):
    """Process a batch of articles through the pipeline"""
    db = SessionLocal()
    try:
        logger.info(f"Processing {len(articles)} articles")
        processor = ArticleProcessor(db)
        processed = processor.process_articles(articles)

        logger.info(f"Successfully processed {len(processed)} articles")
        return len(processed)

    except Exception as e:
        logger.error(f"Error processing articles: {e}")
        return 0

    finally:
        db.close()


@celery_app.task
def fetch_all_articles():
    """Fetch articles from all sources in parallel"""
    logger.info("Starting scheduled article fetch from all sources")

    # Create a group of tasks to run in parallel
    job = group([
        fetch_google_news.s(),
        # fetch_linkedin.s(),
        # fetch_newsapi.s()  # Commented out as per requirements
    ])

    # Execute the group
    result = job.apply_async()
    return "Scheduled article fetch tasks"
