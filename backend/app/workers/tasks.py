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
from app.db.models import Industry, Article
from app.db.utils import update_articles_timestamp
from app.core.redis import get_redis_client
import json


# Configure logging
logger = logging.getLogger(__name__)


@celery_app.task
def fetch_google_news(industry=None):
    """Fetch articles from Google News RSS and process them"""
    db = SessionLocal()
    try:
        # If industry is specified, use industry-specific topics
        if industry:
            logger.info(
                f"Fetching articles from Google News for industry: {industry}")

            # Define industry-specific topics
            industry_topics = {
                Industry.BFSI: [
                    "ai banking", "fintech ai", "AI financial services", "insurtech",
                    "AI banking innovation", "AI finance applications"
                ],
                Industry.RETAIL: [
                    "ai retail", "retail technology ai", "ecommerce ai",
                    "ai shopping innovation", "retail automation ai"
                ],
                Industry.HEALTHCARE: [
                    "healthcare ai", "medical ai innovation", "ai patient care",
                    "ai diagnostics", "telemedicine ai"
                ],
                Industry.TECHNOLOGY: [
                    "artificial intelligence", "generative ai", "ai technology"
                ],
                Industry.OTHER: [
                    "business ai", "enterprise ai", "operational ai"
                ]
            }

            # Get topics for this industry
            topics = industry_topics.get(industry, ["artificial intelligence"])

            # Create connector with specific topics
            connector = GoogleNewsConnector(db, topics=topics)

            # Fetch twice as many articles per industry to ensure we have enough after filtering
            articles_per_industry = (
                settings.ARTICLE_FETCH_LIMIT // len(Industry)) * 2
            articles = connector.fetch_since(
                days=7, limit=articles_per_industry)
        else:
            # Default behavior for backward compatibility
            logger.info("Fetching articles from Google News (all topics)")
            connector = GoogleNewsConnector(db)
            articles = connector.fetch_since(
                days=7, limit=settings.ARTICLE_FETCH_LIMIT // 2)  # Reduced to 50% of total limit

        if articles:
            logger.info(
                f"Found {len(articles)} new articles from Google News{' for ' + industry if industry else ''}")
            process_articles.delay(articles)
        else:
            logger.info(
                f"No new articles found from Google News{' for ' + industry if industry else ''}")

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
def update_all_relevance_scores():
    """Update all existing articles' relevance scores based on the new recency-only formula"""
    db = SessionLocal()
    try:
        logger.info("Starting update of all article relevance scores")

        # Get all articles
        articles = db.query(Article).all()
        count = 0

        # Create processor
        processor = ArticleProcessor(db)

        for article in articles:
            # Calculate new relevance score
            article.relevance_score = processor._calculate_relevance_score(
                article)
            count += 1

        # Commit all changes
        db.commit()

        # Update the last updated timestamp
        update_articles_timestamp(db)

        logger.info(
            f"Successfully updated relevance scores for {count} articles")
        return count

    except Exception as e:
        logger.error(f"Error updating relevance scores: {e}")
        db.rollback()
        return 0

    finally:
        db.close()


@celery_app.task
def fetch_all_articles():
    """Fetch articles from all sources with balanced industry distribution"""
    logger.info(
        "Starting article fetch from all sources with balanced distribution")

    # Remove general fetch and keep only industry-specific fetches for efficiency
    industry_jobs = []
    for industry in [i.value for i in Industry]:
        # Create a task for each industry
        job = fetch_google_news.s(industry=industry)
        result = job.apply_async()
        industry_jobs.append(result)

    # Update the last updated timestamp
    db = SessionLocal()
    try:
        update_articles_timestamp(db)
    finally:
        db.close()

    # Removed: No longer schedule automatic re-ranking after 5 minutes
    # update_all_relevance_scores.apply_async(countdown=300)

    return "Scheduled balanced article fetch tasks"


@celery_app.task(bind=True)
def batch_score_articles_async(self, article_ids, persona):
    """
    Process and score articles in batches asynchronously.

    This task scores articles based on persona relevance in parallel batches,
    with progress tracking and incremental result delivery.

    Args:
        article_ids: List of article IDs to score
        persona: Persona data for personalization

    Returns:
        task_id: The ID of this task for status checking
    """
    db = SessionLocal()
    redis_client = get_redis_client()
    task_id = self.request.id

    try:
        logger.info(
            f"Starting async batch scoring for {len(article_ids)} articles. Task ID: {task_id}")

        # Initialize progress in Redis
        redis_client.hset(
            f"article_scoring:{task_id}",
            mapping={
                "total": len(article_ids),
                "processed": 0,
                "status": "processing",
                "results": json.dumps([])
            }
        )
        # Expire after 1 hour
        redis_client.expire(f"article_scoring:{task_id}", 3600)

        # Create processor for personalized scoring
        processor = ArticleProcessor(db)

        # Batch size for processing
        BATCH_SIZE = 5

        # Split into batches
        batches = [article_ids[i:i + BATCH_SIZE]
                   for i in range(0, len(article_ids), BATCH_SIZE)]

        # Process batches
        all_results = []
        processed_count = 0

        for batch in batches:
            # Get articles for this batch
            batch_articles = db.query(Article).filter(
                Article.id.in_(batch)).all()
            batch_results = []

            # Score each article in the batch
            for article in batch_articles:
                score = processor.calculate_combined_relevance_score(
                    article, persona)

                result = {
                    "id": article.id,
                    "relevance_score": score
                }
                batch_results.append(result)
                all_results.append(result)

                # Update progress after each article
                processed_count += 1
                redis_client.hset(
                    f"article_scoring:{task_id}", "processed", processed_count)

                # Update progress percentage for the Celery task
                self.update_state(
                    state='PROGRESS',
                    meta={'processed': processed_count,
                          'total': len(article_ids)}
                )

            # Update results in Redis after each batch
            redis_client.hset(
                f"article_scoring:{task_id}",
                "results",
                json.dumps(all_results)
            )

        # Mark as completed
        redis_client.hset(f"article_scoring:{task_id}", "status", "completed")

        logger.info(f"Completed async batch scoring for task {task_id}")
        return {"task_id": task_id, "status": "completed", "scored_count": len(all_results)}

    except Exception as e:
        logger.error(f"Error in batch scoring task: {e}")
        # Mark as failed
        redis_client.hset(f"article_scoring:{task_id}", "status", "failed")
        redis_client.hset(f"article_scoring:{task_id}", "error", str(e))

        raise

    finally:
        db.close()
