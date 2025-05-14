from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import random  # For generating demo images
# Updated import for pgvector 0.4.1

from app.db.models import Article, Industry
from app.api.deps import get_db
from app.pipeline.processor import ArticleProcessor
from app.workers.tasks import fetch_all_articles, update_all_relevance_scores
from app.db.utils import get_articles_timestamp, update_articles_timestamp


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


@router.post("/", response_model=dict)
def get_articles_with_persona(
    db: Session = Depends(get_db),
    persona: Optional[dict] = Body(None),
    industry: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query(
        "relevance_score", regex="^(published_at|relevance_score)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    balanced: bool = Query(
        True, description="Whether to balance articles across industries"),
    use_llm: bool = Query(
        True, description="Whether to use LLM for relevance scoring (more accurate but slower)")
):
    """
    Get articles with persona-based relevance ranking.

    When a persona is provided, articles are ranked based on a combination of:
    - Recency (time-based relevance)
    - Persona relevance (job title, company, industry, conversation context)

    When no persona is provided, uses the standard recency-based ranking.
    """
    # Create processor for personalized scoring
    processor = ArticleProcessor(db)

    # Optimization for LLM calls:
    # 1. Use the fallback method for initial filtering/ranking
    # 2. Apply OpenAI scoring only to the top candidates

    # Similar logic to GET endpoint, but with personalized scoring
    if balanced and industry is None:
        # Gather articles across all industries in a balanced way
        all_industries = [i.value for i in Industry]

        # Calculate articles per industry
        articles_per_industry = max(1, limit // len(all_industries))

        # Collect articles from each industry
        articles = []

        for ind in all_industries:
            # Basic query for this industry
            industry_query = db.query(Article).filter(Article.industry == ind)

            # Apply sorting (but we'll re-sort later if persona is provided)
            if sort_order == "desc":
                industry_query = industry_query.order_by(
                    desc(getattr(Article, sort_by)))
            else:
                industry_query = industry_query.order_by(
                    getattr(Article, sort_by))

            # Get articles for this industry
            industry_articles = industry_query.limit(
                articles_per_industry).all()
            articles.extend(industry_articles)

        # If persona is provided, we need to recalculate scores and re-sort
        if persona:
            # If using LLM scoring, we want to be efficient about it
            if use_llm:
                # First pass: use lightweight method for all articles
                for article in articles:
                    # Pre-rank with keyword matching (fast)
                    article.relevance_score = processor._calculate_persona_relevance_fallback(
                        article, persona)

                # Sort based on initial scores
                articles.sort(key=lambda a: a.relevance_score, reverse=True)

                # Second pass: use LLM only for the top candidates (limit * 1.5)
                # This ensures we get the most relevant articles with full LLM scoring
                llm_scoring_limit = min(len(articles), int(limit * 1.5))
                for i in range(llm_scoring_limit):
                    articles[i].relevance_score = processor.calculate_combined_relevance_score(
                        articles[i], persona)

                # Final sort based on LLM-enhanced scores
                articles.sort(key=lambda a: a.relevance_score,
                              reverse=(sort_order == "desc"))
            else:
                # Use simpler scoring for all articles
                for article in articles:
                    article.relevance_score = processor.calculate_combined_relevance_score(
                        article, persona)

                # Resort based on new scores
                articles.sort(key=lambda a: a.relevance_score,
                              reverse=(sort_order == "desc"))

            # Apply offset and limit after sorting
            articles = articles[offset:offset+limit]
    else:
        # Handle specified industry or unbalanced mode
        query = db.query(Article)

        # Apply industry filter
        if industry and industry.lower() in [i.value for i in Industry]:
            query = query.filter(Article.industry == industry.lower())

        # If using persona, we need to fetch more articles, recalculate scores, then sort and limit
        if persona:
            # Fetch more articles than needed to apply personalized sorting
            # This ensures we have enough articles after personalized sorting
            # Reasonable cap to avoid performance issues
            expanded_limit = min(500, limit * 3)

            # Apply basic sorting for initial fetch
            if sort_order == "desc":
                query = query.order_by(desc(getattr(Article, sort_by)))
            else:
                query = query.order_by(getattr(Article, sort_by))

            # Fetch articles
            expanded_articles = query.offset(
                offset).limit(expanded_limit).all()

            # If using LLM, apply the two-pass optimization
            if use_llm and persona:
                # First pass: calculate baseline scores
                for article in expanded_articles:
                    article.relevance_score = processor._calculate_persona_relevance_fallback(
                        article, persona)

                # Sort by baseline scores
                expanded_articles.sort(
                    key=lambda a: a.relevance_score, reverse=True)

                # Second pass: apply LLM scoring to top candidates
                llm_candidates = min(len(expanded_articles), limit * 2)
                for i in range(llm_candidates):
                    expanded_articles[i].relevance_score = processor.calculate_combined_relevance_score(
                        expanded_articles[i], persona
                    )

                # Final sort with LLM-enhanced scores
                expanded_articles.sort(
                    key=lambda a: a.relevance_score, reverse=(sort_order == "desc"))
            else:
                # Recalculate scores with persona using simpler method
                for article in expanded_articles:
                    article.relevance_score = processor.calculate_combined_relevance_score(
                        article, persona)

                # Sort based on new scores
                expanded_articles.sort(
                    key=lambda a: a.relevance_score, reverse=(sort_order == "desc"))

            # Apply final limit after persona-based sorting
            articles = expanded_articles[:limit]
        else:
            # Standard sorting and fetching without persona
            if sort_order == "desc":
                query = query.order_by(desc(getattr(Article, sort_by)))
            else:
                query = query.order_by(getattr(Article, sort_by))

            # Apply pagination
            articles = query.offset(offset).limit(limit).all()

    # Convert to dictionary with the same format as the GET endpoint
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

    # Update timestamp to reflect this personalization
    if persona:
        update_articles_timestamp(db)

    # Return articles with last_updated timestamp
    return {
        "articles": result,
        "last_updated": last_updated,
        "persona_applied": persona is not None,
        "llm_enhanced": use_llm and persona is not None
    }


@router.post("/batch-score", response_model=dict)
def batch_score_articles(
    db: Session = Depends(get_db),
    request_data: dict = Body(...),
):
    """
    Score a batch of articles for a specific persona using LLM.

    This endpoint accepts a list of article IDs and a persona,
    and returns personalization scores for those articles.
    """
    article_ids = request_data.get("article_ids", [])
    persona = request_data.get("persona")

    if not article_ids or not persona:
        raise HTTPException(
            status_code=400, detail="Article IDs and persona are required")

    # Create processor for personalized scoring
    processor = ArticleProcessor(db)

    # Retrieve articles by ID
    articles = db.query(Article).filter(Article.id.in_(article_ids)).all()

    # Score articles using LLM
    scored_articles = []
    for article in articles:
        # Calculate combined score using LLM, skip the fallback method
        # We're using the calculate_combined_relevance_score which will use the LLM
        # for persona relevance scoring
        score = processor.calculate_combined_relevance_score(article, persona)

        scored_articles.append({
            "id": article.id,
            "relevance_score": score
        })

    # Update timestamp to reflect this personalization
    update_articles_timestamp(db)

    return {
        "scored_articles": scored_articles,
        "persona_applied": True,
        "llm_enhanced": True
    }
