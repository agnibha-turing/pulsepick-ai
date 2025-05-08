import openai
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import math
import json

from app.db.models import Article, Industry
from app.core.config import settings


class ArticleProcessor:
    """Process articles through the full pipeline: 
    1. Deduplication
    2. Summarization
    3. Industry classification
    4. Vector embedding
    """

    def __init__(self, db: Session):
        self.db = db
        self.openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

    def process_articles(self, articles: List[Dict[str, Any]]) -> List[Article]:
        """
        Process a batch of articles through the full pipeline

        Args:
            articles: List of article dictionaries to process

        Returns:
            List of Article objects that were successfully processed and saved
        """
        processed_articles = []

        for article_data in articles:
            # Check if article with this URL already exists (deduplication)
            existing = self.db.query(Article).filter(
                Article.url == article_data['url']).first()
            if existing:
                continue

            try:
                # Create new article
                article = Article(**article_data)

                # Generate summary if content exists
                if article.content:
                    article.summary = self._generate_summary(
                        article.title, article.content)

                # Classify industry
                article.industry = self._classify_industry(
                    article.title, article.content or "", article.summary or "")

                # Generate embeddings for vector search
                article.embedding = self._generate_embedding(
                    f"{article.title}. {article.summary or article.content or ''}"
                )

                # Calculate relevance score (recency-based for now)
                article.relevance_score = self._calculate_relevance_score(
                    article)

                # Save to database
                self.db.add(article)
                self.db.commit()
                self.db.refresh(article)

                processed_articles.append(article)

            except Exception as e:
                # Log error but continue with other articles
                print(
                    f"Error processing article '{article_data.get('title', '')}': {e}")
                self.db.rollback()
                continue

        return processed_articles

    def _generate_summary(self, title: str, content: str, max_length: int = 200) -> str:
        """Generate a concise summary of the article using OpenAI"""
        try:
            prompt = f"Summarize this article in 2-3 sentences:\nTitle: {title}\nContent: {content}"

            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that summarizes articles concisely."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.3
            )

            summary = response.choices[0].message.content.strip()
            return summary

        except Exception as e:
            print(f"Error generating summary: {e}")
            # Fallback to simple summary if OpenAI fails
            return content[:max_length] + "..." if len(content) > max_length else content

    def _classify_industry(self, title: str, content: str, summary: str) -> str:
        """Classify the article into an industry category using OpenAI"""
        try:
            # Combine title and summary for classification
            text = f"Title: {title}\nSummary: {summary}\nExcerpt: {content[:500]}..."

            prompt = f"Classify this article into exactly ONE of these industries: BFSI (Banking, Financial Services, Insurance), Retail, Healthcare, Technology, Other.\nReturn only the label as a single word.\n\n{text}"

            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that classifies articles by industry."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0.3
            )

            industry = response.choices[0].message.content.strip().lower()

            # Map the response to our Industry enum values
            industry_mapping = {
                "bfsi": Industry.BFSI,
                "banking": Industry.BFSI,
                "financial": Industry.BFSI,
                "finance": Industry.BFSI,
                "insurance": Industry.BFSI,
                "retail": Industry.RETAIL,
                "healthcare": Industry.HEALTHCARE,
                "health": Industry.HEALTHCARE,
                "medical": Industry.HEALTHCARE,
                "technology": Industry.TECHNOLOGY,
                "tech": Industry.TECHNOLOGY,
                "other": Industry.OTHER
            }

            return industry_mapping.get(industry, Industry.OTHER)

        except Exception as e:
            print(f"Error classifying industry: {e}")
            return Industry.OTHER

    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for the article text using OpenAI"""
        try:
            response = self.openai_client.embeddings.create(
                model=settings.OPENAI_EMBEDDING_MODEL,
                # OpenAI has a token limit, truncate if necessary
                input=text[:8000]
            )

            return response.data[0].embedding

        except Exception as e:
            print(f"Error generating embedding: {e}")
            # Return zero vector as fallback
            return [0.0] * settings.OPENAI_EMBEDDING_DIMENSIONS

    def _calculate_relevance_score(self, article: Article) -> float:
        """
        Calculate a relevance score for the article based on recency

        Formula: score = exp(-λ * days_old) where λ≈0.5
        - A fresh article (0 days) has score 1.0
        - A 1-day old article has score ~0.6
        - A 3-day old article has score ~0.22
        """
        if not article.published_at:
            return 0.0

        days_old = (datetime.utcnow() - article.published_at).days
        decay_factor = 0.5  # Controls how quickly relevance decays with age

        return math.exp(-decay_factor * max(0, days_old))
