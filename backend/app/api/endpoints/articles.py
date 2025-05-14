from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import random  # For generating demo images
# Updated import for pgvector 0.4.1

from app.db.models import Article, Industry
from app.api.deps import get_db
from app.pipeline.processor import ArticleProcessor
from app.workers.tasks import fetch_all_articles, update_all_relevance_scores
from app.db.utils import get_articles_timestamp


router = APIRouter()


@router.get("/", response_model=dict)
def get_articles(
    db: Session = Depends(get_db),
    industry: Optional[str] = None,
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query(
        "published_at", regex="^(published_at|relevance_score)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    balanced: bool = Query(
        True, description="Whether to balance articles across industries")
):
    """
    Get articles with optional filtering by industry
    """
    # If specific industry is requested, use original logic
    if industry:
        query = db.query(Article)

        # Apply industry filter if provided
        if industry.lower() in [i.value for i in Industry]:
            query = query.filter(Article.industry == industry.lower())

        # Apply sorting
        if sort_order == "desc":
            query = query.order_by(desc(getattr(Article, sort_by)))
        else:
            query = query.order_by(getattr(Article, sort_by))

        # Apply pagination
        total_count = query.count()
        articles = query.offset(offset).limit(limit).all()

    # For balanced distribution across industries
    elif balanced:
        # Define all industries
        industries = [i.value for i in Industry]

        # Calculate articles per industry (ensure at least 1 per industry)
        articles_per_industry = max(limit // len(industries), 1)

        # Collect articles from each industry
        articles = []

        for ind in industries:
            industry_query = db.query(Article).filter(Article.industry == ind)

            # Apply sorting
            if sort_order == "desc":
                industry_query = industry_query.order_by(
                    desc(getattr(Article, sort_by)))
            else:
                industry_query = industry_query.order_by(
                    getattr(Article, sort_by))

            # Get exactly the requested number of articles for this industry
            industry_articles = industry_query.limit(
                articles_per_industry).all()
            articles.extend(industry_articles)

        # If we couldn't get enough articles from some industries, add from others to fill the limit
        if len(articles) < limit:
            # Calculate how many more we need
            remaining = limit - len(articles)

            # Get article IDs we already have
            existing_ids = [a.id for a in articles]

            # Query for additional articles from any industry
            additional_query = db.query(Article).filter(
                Article.id.notin_(existing_ids))

            # Apply sorting
            if sort_order == "desc":
                additional_query = additional_query.order_by(
                    desc(getattr(Article, sort_by)))
            else:
                additional_query = additional_query.order_by(
                    getattr(Article, sort_by))

            # Get remaining articles
            additional_articles = additional_query.limit(remaining).all()
            articles.extend(additional_articles)

    # Unbalanced mode - just get articles based on sorting
    else:
        query = db.query(Article)

        # Apply sorting
        if sort_order == "desc":
            query = query.order_by(desc(getattr(Article, sort_by)))
        else:
            query = query.order_by(getattr(Article, sort_by))

        # Apply pagination
        articles = query.offset(offset).limit(limit).all()

    # Convert to dictionary to add metadata
    result = []
    for article in articles:
        article_dict = {
            "id": article.id,
            "title": article.title,
            "url": article.url,
            "author": article.author or "Unknown Author",
            "published_at": article.published_at,
            "summary": article.summary,
            "industry": article.industry,
            "relevance_score": article.relevance_score,
            "keywords": article.keywords if article.keywords else ["AI", "Technology", "News"],
            "source": {
                "id": article.source.id,
                "name": article.source.name,
                "type": article.source.type
            } if article.source else None
        }
        result.append(article_dict)

    # Get last updated timestamp
    last_updated = get_articles_timestamp(db)

    # Return articles with last_updated timestamp
    return {
        "articles": result,
        "last_updated": last_updated
    }


@router.get("/search", response_model=dict)
def search_articles(
    q: str,
    db: Session = Depends(get_db),
    industry: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Search articles using vector similarity search
    """
    # Create processor to generate embedding for search query using configured model
    processor = ArticleProcessor(db)
    query_embedding = processor._generate_embedding(q)

    # Start building the query
    query = db.query(
        Article,
        # Calculate similarity score using cosine_distance (1 - distance gives similarity)
        (1 - Article.embedding.cosine_distance(query_embedding)
         ).label("similarity_score")
    )

    # Apply industry filter if provided
    if industry and industry.lower() in [i.value for i in Industry]:
        query = query.filter(Article.industry == industry.lower())

    # Apply vector similarity search and order by similarity
    query = query.order_by(desc("similarity_score"))

    # Apply pagination
    results = query.offset(offset).limit(limit).all()

    # Convert to dictionary with similarity score
    result = []
    for article, similarity in results:
        article_dict = {
            "id": article.id,
            "title": article.title,
            "url": article.url,
            "author": article.author,
            "published_at": article.published_at,
            "summary": article.summary,
            "industry": article.industry,
            "relevance_score": article.relevance_score,
            "keywords": article.keywords if article.keywords else ["AI", "Technology", "News"],
            "similarity_score": round(float(similarity), 4),
            "source": {
                "id": article.source.id,
                "name": article.source.name,
                "type": article.source.type
            } if article.source else None
        }
        result.append(article_dict)

    # Get last updated timestamp
    last_updated = get_articles_timestamp(db)

    # Return articles with last_updated timestamp
    return {
        "articles": result,
        "last_updated": last_updated
    }


@router.post("/fetch", response_model=dict)
def trigger_fetch():
    """
    Manually trigger the article fetching process
    """
    # Call the Celery task asynchronously
    task = fetch_all_articles.delay()

    return {
        "message": "Article fetching triggered successfully",
        "task_id": task.id
    }


@router.post("/update-scores", response_model=dict)
def trigger_update_scores():
    """
    Manually trigger the update of all article relevance scores
    """
    # Call the Celery task asynchronously
    task = update_all_relevance_scores.delay()

    return {
        "message": "Relevance score update triggered successfully",
        "task_id": task.id
    }
