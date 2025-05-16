from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
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
from app.feeds.techcrunch import TechCrunchConnector
from app.feeds.hackernews import HackerNewsConnector
from app.pipeline.processor import ArticleProcessor
from app.core.config import settings
from app.db.models import Industry, Article
from app.db.utils import update_articles_timestamp
from app.core.redis import get_redis_client
import json


# Configure logging
logger = logging.getLogger(__name__)

# Unified industry topics - used consistently across all sources
INDUSTRY_TOPICS = {
    Industry.BFSI: [
        "fintech", "banking ai", "financial services", "insurtech",
        "finance innovation", "financial technology", "banking technology"
    ],
    Industry.RETAIL: [
        "retail technology", "ecommerce", "consumer tech", "retail automation",
        "shopping innovation", "retail ai", "retail digital transformation"
    ],
    Industry.HEALTHCARE: [
        "healthtech", "medical technology", "biotech", "healthcare ai",
        "digital health", "telemedicine", "health innovation", "medical ai"
    ],
    Industry.TECHNOLOGY: [
        "artificial intelligence", "machine learning", "cloud computing",
        "software development", "generative ai", "tech innovation",
        "emerging technology", "startup technology"
    ],
    Industry.OTHER: [
        "business technology", "enterprise solutions", "operational tech",
        "business innovation", "digital transformation", "tech trends"
    ]
}


@celery_app.task
def fetch_google_news(industry=None):
    """Fetch articles from Google News RSS and process them"""
    db = SessionLocal()
    try:
        # If industry is specified, use industry-specific topics
        if industry:
            logger.info(
                f"Fetching articles from Google News for industry: {industry}")

            # Get topics for this industry
            topics = INDUSTRY_TOPICS.get(industry, ["artificial intelligence"])

            # Create connector with specific topics
            connector = GoogleNewsConnector(db, topics=topics)

            # Calculate articles per industry based on configurable distribution
            articles_per_industry = int(
                (settings.ARTICLE_FETCH_LIMIT * settings.GOOGLE_NEWS_PERCENTAGE / 100) // len(Industry)) * 2
            articles = connector.fetch_since(
                days=7, limit=articles_per_industry)
        else:
            # Default behavior for backward compatibility
            logger.info("Fetching articles from Google News (all topics)")
            connector = GoogleNewsConnector(db)
            # Use configurable percentage
            articles = connector.fetch_since(
                days=7, limit=int(settings.ARTICLE_FETCH_LIMIT * settings.GOOGLE_NEWS_PERCENTAGE / 100))

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
def fetch_newsapi(industry=None):
    """Fetch articles from NewsAPI and process them, being mindful of the API call limit (1000/day)"""
    db = SessionLocal()
    try:
        # Early exit if NewsAPI percentage is set to 0
        if settings.NEWSAPI_PERCENTAGE <= 0:
            logger.info(
                "Skipping NewsAPI fetch as it is disabled in configuration (percentage set to 0)")
            return 0

        if industry:
            logger.info(
                f"Fetching articles from NewsAPI for industry: {industry}")
            # Get most valuable topics for this industry (limited to conserve API calls)
            topics = INDUSTRY_TOPICS.get(industry, ["technology"])[
                :2]  # Limit to 2 topics per industry

            # For NewsAPI, use configurable percentage
            articles_per_industry = int(
                (settings.ARTICLE_FETCH_LIMIT * settings.NEWSAPI_PERCENTAGE / 100) // len(Industry))

            # Create connector with conservative settings
            connector = NewsAPIConnector(db)
            # Use a shorter timeframe to reduce unnecessary results
            articles = connector.fetch_since(
                days=2, limit=articles_per_industry)
        else:
            # Default behavior, use more conservative settings
            logger.info("Fetching articles from NewsAPI (conservative)")
            connector = NewsAPIConnector(db)
            # Use configurable percentage
            articles = connector.fetch_since(
                days=2, limit=int(settings.ARTICLE_FETCH_LIMIT * settings.NEWSAPI_PERCENTAGE / 100))

        if articles:
            logger.info(
                f"Found {len(articles)} new articles from NewsAPI{' for ' + industry if industry else ''}")
            process_articles.delay(articles)
        else:
            logger.info(
                f"No new articles found from NewsAPI{' for ' + industry if industry else ''}")

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
    """
    Fetch articles from all sources with balanced industry distribution

    Source distribution percentages are configurable via environment variables or .env file:
    - GOOGLE_NEWS_PERCENTAGE: Default 45%
    - NEWSAPI_PERCENTAGE: Default 10% (reduce to conserve API calls)
    - TECHCRUNCH_PERCENTAGE: Default 25%
    - HACKERNEWS_PERCENTAGE: Default 20%

    Example: To disable NewsAPI, set NEWSAPI_PERCENTAGE=0
    """
    logger.info(
        f"Starting article fetch with distribution: "
        f"Google News: {settings.GOOGLE_NEWS_PERCENTAGE}%, "
        f"NewsAPI: {settings.NEWSAPI_PERCENTAGE}%, "
        f"TechCrunch: {settings.TECHCRUNCH_PERCENTAGE}%, "
        f"Hacker News: {settings.HACKERNEWS_PERCENTAGE}%"
    )

    industry_jobs = []

    # Scheduled industry-specific jobs for each source
    for industry in [i.value for i in Industry]:
        # Create tasks for each source and industry
        google_job = fetch_google_news.s(industry=industry)
        result_google = google_job.apply_async()
        industry_jobs.append(result_google)

        # Only fetch from NewsAPI if percentage is greater than 0
        if settings.NEWSAPI_PERCENTAGE > 0:
            newsapi_job = fetch_newsapi.s(industry=industry)
            result_newsapi = newsapi_job.apply_async()
            industry_jobs.append(result_newsapi)

        techcrunch_job = fetch_techcrunch.s(industry=industry)
        hackernews_job = fetch_hackernews.s(industry=industry)

        # Apply each task
        result_techcrunch = techcrunch_job.apply_async()
        result_hackernews = hackernews_job.apply_async()

        # Add remaining jobs to the tracking list
        industry_jobs.extend([result_techcrunch, result_hackernews])

    # Update the last updated timestamp
    db = SessionLocal()
    try:
        update_articles_timestamp(db)
    finally:
        db.close()

    return f"Scheduled balanced article fetch tasks from all sources: {len(industry_jobs)} jobs"


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


@celery_app.task
def fetch_techcrunch(industry=None):
    """Fetch articles from TechCrunch RSS feeds and process them"""
    db = SessionLocal()
    try:
        # Define category mapping for TechCrunch based on unified topics
        # Maps our topics to TechCrunch's available category feeds
        category_mapping = {
            "fintech": "fintech",
            "financial services": "fintech",
            "banking": "fintech",
            "retail": "startups",
            "ecommerce": "startups",
            "healthcare": "startups",
            "healthtech": "startups",
            "biotech": "startups",
            "artificial intelligence": "ai",
            "machine learning": "ai",
            "tech innovation": "startups",
            "cloud computing": "enterprise",
            "software development": "enterprise",
            "business technology": "enterprise",
            "enterprise": "enterprise"
        }

        # If industry is specified, use industry-specific categories
        if industry:
            logger.info(
                f"Fetching articles from TechCrunch for industry: {industry}")

            # Convert our unified topics to TechCrunch categories
            topics = INDUSTRY_TOPICS.get(industry, ["artificial intelligence"])
            categories = set()

            # Map topics to categories
            for topic in topics:
                for keyword in topic.split():
                    if keyword.lower() in category_mapping:
                        categories.add(category_mapping[keyword.lower()])

            # Ensure we have at least one category
            if not categories:
                categories = {"startups", "ai"}

            connector = TechCrunchConnector(db, categories=list(categories))

            # Calculate articles per industry based on configurable distribution
            articles_per_industry = int(
                (settings.ARTICLE_FETCH_LIMIT * settings.TECHCRUNCH_PERCENTAGE / 100) // len(Industry))
            # Fetch more to ensure enough quality content
            articles = connector.fetch_since(
                days=7, limit=articles_per_industry * 2)
        else:
            # Default behavior for general fetch
            logger.info("Fetching articles from TechCrunch (all categories)")
            connector = TechCrunchConnector(db)
            # Use configurable percentage
            articles = connector.fetch_since(days=7, limit=int(
                settings.ARTICLE_FETCH_LIMIT * settings.TECHCRUNCH_PERCENTAGE / 100))

        if articles:
            logger.info(
                f"Found {len(articles)} new articles from TechCrunch{' for ' + industry if industry else ''}")
            process_articles.delay(articles)
        else:
            logger.info(
                f"No new articles found from TechCrunch{' for ' + industry if industry else ''}")

        return len(articles)

    except Exception as e:
        logger.error(f"Error fetching from TechCrunch: {e}")
        return 0
    finally:
        db.close()


@celery_app.task
def fetch_hackernews(industry=None):
    """Fetch articles from Hacker News RSS feeds and process them"""
    db = SessionLocal()
    try:
        # Feed types appropriate for each industry
        industry_feed_types = {
            Industry.BFSI: ["front_page", "newest"],
            Industry.RETAIL: ["front_page", "newest"],
            Industry.HEALTHCARE: ["front_page", "newest"],
            Industry.TECHNOLOGY: ["front_page", "newest", "show"],
            Industry.OTHER: ["front_page"]
        }

        # If industry is specified, use industry-specific settings
        if industry:
            logger.info(
                f"Fetching articles from Hacker News for industry: {industry}")

            # Get feed types for this industry
            feed_types = industry_feed_types.get(
                industry, ["front_page", "newest"])

            # Get search topics from unified topics
            search_topics = INDUSTRY_TOPICS.get(industry, ["technology"])

            connector = HackerNewsConnector(db, feed_types=feed_types)

            # Calculate articles per industry based on configurable distribution
            articles_per_industry = int(
                (settings.ARTICLE_FETCH_LIMIT * settings.HACKERNEWS_PERCENTAGE / 100) // len(Industry))

            # First fetch from feeds
            articles = connector.fetch_since(
                days=5, limit=articles_per_industry)

            # If we have search topics and there's room for more articles,
            # try to get topic-specific articles using Algolia search
            if len(articles) < articles_per_industry:
                remaining = articles_per_industry - len(articles)
                for topic in search_topics:
                    # Get a portion of the remaining articles for each topic
                    topic_limit = max(5, remaining // len(search_topics))

                    # Create a timezone-aware datetime object for the search
                    since_date = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=5)

                    topic_articles = connector.search_by_topic(topic,
                                                               since=since_date,
                                                               limit=topic_limit)
                    if topic_articles:
                        # Add non-duplicate articles
                        existing_urls = {a["url"] for a in articles}
                        for article in topic_articles:
                            if article["url"] not in existing_urls:
                                articles.append(article)
                                existing_urls.add(article["url"])

                            # Stop if we've reached our target
                            if len(articles) >= articles_per_industry:
                                break

                    # Stop if we've reached our target
                    if len(articles) >= articles_per_industry:
                        break
        else:
            # Default behavior for general fetch
            logger.info("Fetching articles from Hacker News (general)")
            connector = HackerNewsConnector(db)
            # Use configurable percentage
            articles = connector.fetch_since(
                days=5, limit=int(settings.ARTICLE_FETCH_LIMIT * settings.HACKERNEWS_PERCENTAGE / 100))

        if articles:
            logger.info(
                f"Found {len(articles)} new articles from Hacker News{' for ' + industry if industry else ''}")
            process_articles.delay(articles)
        else:
            logger.info(
                f"No new articles found from Hacker News{' for ' + industry if industry else ''}")

        return len(articles)

    except Exception as e:
        logger.error(f"Error fetching from Hacker News: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0
    finally:
        db.close()
