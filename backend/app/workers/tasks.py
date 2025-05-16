from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging
from celery import group
import os
import asyncio
import time

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

    This task scores articles based on persona relevance in optimized batches,
    using OpenAI's batch API capabilities for maximum performance.

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
        # Set a reasonable expiration time for processing tasks
        # 40 minutes for processing (increased from 30 to 40 for larger batch size)
        redis_client.expire(f"article_scoring:{task_id}", 2400)

        # Create processor for personalized scoring
        processor = ArticleProcessor(db)

        # Increase batch size substantially - OpenAI batch API can handle larger batches efficiently
        BATCH_SIZE = 100  # Updated from 50 to 100 to match the display limit

        # Split into batches
        batches = [article_ids[i:i + BATCH_SIZE]
                   for i in range(0, len(article_ids), BATCH_SIZE)]

        # Process batches
        all_results = []
        processed_count = 0

        # Keep track of total articles successfully processed
        total_processed = 0

        # The improved processor implementation now:
        # 1. Uses async/await for parallel API requests (up to 10x faster)
        # 2. Implements Redis caching with 24-hour expiration (instant for repeat queries)
        # 3. Processes all articles in a single batch concurrently

        # Process each batch of article IDs
        for batch_idx, batch in enumerate(batches):
            start_time = time.time()
            logger.info(
                f"Processing batch {batch_idx+1}/{len(batches)} with {len(batch)} articles")

            # Get articles for this batch
            batch_articles = db.query(Article).filter(
                Article.id.in_(batch)).all()

            # Skip empty batches
            if not batch_articles:
                logger.warning(
                    f"Batch {batch_idx+1} contained no valid articles, skipping")
                continue

            # Use the batch scoring method with async capabilities
            try:
                # This method now implements caching and async processing internally
                scores = processor.calculate_combined_relevance_scores_batch(
                    batch_articles, persona)

                # Create results
                batch_results = []
                for i, article in enumerate(batch_articles):
                    if i < len(scores):
                        result = {
                            "id": article.id,
                            "relevance_score": scores[i]
                        }
                        batch_results.append(result)
                        all_results.append(result)

                # Update processed count
                processed_count = total_processed + len(batch_results)
                total_processed = processed_count

                end_time = time.time()
                batch_time = end_time - start_time
                articles_per_second = len(
                    batch_results) / batch_time if batch_time > 0 else 0

                logger.info(f"Batch {batch_idx+1} processed {len(batch_results)} articles in {batch_time:.2f}s "
                            f"({articles_per_second:.2f} articles/sec). Total: {processed_count}/{len(article_ids)}")

                # Update progress in Redis - only do this once per batch to reduce Redis operations
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

            except Exception as e:
                # Log the error but continue processing other batches
                logger.error(f"Error processing batch {batch_idx+1}: {e}")
                # Wait a bit before trying the next batch if there was an error
                time.sleep(1)

        # Mark as completed
        redis_client.hset(f"article_scoring:{task_id}", "status", "completed")

        # Set a reasonable expiration time for completed tasks in production
        # 2 hours is sufficient for production (increased from 1 to 2 hours for larger batch size)
        redis_client.expire(f"article_scoring:{task_id}", 7200)

        logger.info(f"Completed async batch scoring for task {task_id}. "
                    f"Successfully processed {total_processed}/{len(article_ids)} articles.")

        return {"task_id": task_id, "status": "completed", "scored_count": len(all_results)}

    except Exception as e:
        logger.error(f"Error in batch scoring task: {e}")
        # Mark as failed
        redis_client.hset(f"article_scoring:{task_id}", "status", "failed")
        redis_client.hset(f"article_scoring:{task_id}", "error", str(e))

        raise

    finally:
        db.close()
