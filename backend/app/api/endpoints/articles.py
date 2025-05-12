from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import random  # For generating demo images
# Updated import for pgvector 0.4.1

from app.db.models import Article, Industry
from app.api.deps import get_db
from app.pipeline.processor import ArticleProcessor
from app.workers.tasks import fetch_all_articles


router = APIRouter()


@router.get("/", response_model=List[dict])
def get_articles(
    db: Session = Depends(get_db),
    industry: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = Query(
        "published_at", regex="^(published_at|relevance_score)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """
    Get articles with optional filtering by industry
    """
    query = db.query(Article)

    # Apply industry filter if provided
    if industry and industry.lower() in [i.value for i in Industry]:
        query = query.filter(Article.industry == industry.lower())

    # Apply sorting
    if sort_order == "desc":
        query = query.order_by(desc(getattr(Article, sort_by)))
    else:
        query = query.order_by(getattr(Article, sort_by))

    # Apply pagination
    total_count = query.count()
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
            "source": {
                "id": article.source.id,
                "name": article.source.name,
                "type": article.source.type
            } if article.source else None
        }
        result.append(article_dict)

    return result


@router.get("/search", response_model=List[dict])
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
            "similarity_score": round(float(similarity), 4),
            "source": {
                "id": article.source.id,
                "name": article.source.name,
                "type": article.source.type
            } if article.source else None
        }
        result.append(article_dict)

    return result


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
