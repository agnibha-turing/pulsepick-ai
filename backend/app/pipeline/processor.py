import openai
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import math
import json
import re

from app.db.models import Article, Industry
from app.core.config import settings


class ArticleProcessor:
    """Process articles through the full pipeline: 
    1. Deduplication
    2. Summarization
    3. Industry classification
    4. Vector embedding
    5. Enhanced relevance scoring
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

                # Enrich metadata if needed
                if not article.author or not article.published_at:
                    author, date = self._enrich_metadata(
                        article.title, article.content or "", article.url, article.raw_json)
                    if not article.author and author:
                        article.author = author
                    if not article.published_at and date:
                        article.published_at = date

                # Classify industry
                article.industry = self._classify_industry(
                    article.title, article.content or "", article.summary or "")

                # Generate keywords
                article.keywords = self._generate_keywords(
                    article.title, article.content or "", article.summary or "")

                # Generate embeddings for vector search
                article.embedding = self._generate_embedding(
                    f"{article.title}. {article.summary or article.content or ''}"
                )

                # Calculate relevance score
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
        Calculate a relevance score for the article based on multiple factors:
        1. Recency - newer articles get higher scores
        2. Industry weighting - prioritize underrepresented industries

        Formula: score = recency_score * industry_weight
        - A fresh article (0 days) has recency_score 1.0
        - A 1-day old article has recency_score ~0.6
        - A 3-day old article has recency_score ~0.22

        Industry weights increase relevance for BFSI, Retail, and Other categories
        """
        # Base recency score (same as before)
        recency_score = 0.0
        if article.published_at:
            days_old = (datetime.utcnow() - article.published_at).days
            decay_factor = 0.5  # Controls how quickly relevance decays with age
            recency_score = math.exp(-decay_factor * max(0, days_old))

        # Industry weighting to prioritize underrepresented industries
        industry_weights = {
            Industry.BFSI: 2.0,       # Highest priority - strongly boost BFSI
            Industry.RETAIL: 1.8,     # High priority - boost retail articles
            Industry.OTHER: 1.5,       # Medium priority
            Industry.HEALTHCARE: 1.2,  # Slight boost
            # No change for tech (already well-represented)
            Industry.TECHNOLOGY: 1.0
        }

        # Get industry weight (default to 1.0 if industry is not set)
        industry_weight = industry_weights.get(article.industry, 1.0)

        # Combine scores for final relevance
        return recency_score * industry_weight

    def _enrich_metadata(self, title: str, content: str, url: str, raw_json: dict) -> Tuple[Optional[str], Optional[datetime]]:
        """
        Attempt to extract missing metadata (author, publication date) from content

        Returns:
            Tuple of (author, publication_date)
        """
        author = None
        date = None

        # First try to extract from raw_json if available
        if raw_json:
            # Different sources may have different field names
            author_candidates = ['author', 'byline', 'creator', 'dc:creator']
            date_candidates = ['publishedAt', 'pubDate',
                               'date', 'dc:date', 'created', 'published']

            # Try to extract author
            for field in author_candidates:
                if field in raw_json and raw_json[field]:
                    author_value = raw_json[field]
                    # Handle both string and list formats
                    if isinstance(author_value, list) and author_value:
                        author = author_value[0]
                    elif isinstance(author_value, str) and author_value.strip():
                        author = author_value.strip()
                    break

            # Try to extract date
            for field in date_candidates:
                if field in raw_json and raw_json[field]:
                    try:
                        # Attempt to parse the date string
                        date_str = raw_json[field]
                        if isinstance(date_str, str):
                            # Try common date formats
                            for fmt in [
                                '%Y-%m-%dT%H:%M:%SZ',  # ISO format
                                '%Y-%m-%dT%H:%M:%S%z',  # ISO with timezone
                                '%a, %d %b %Y %H:%M:%S %z',  # RSS format
                                '%Y-%m-%d %H:%M:%S',  # Standard format
                                '%Y-%m-%d',  # Simple date
                            ]:
                                try:
                                    date = datetime.strptime(date_str, fmt)
                                    break
                                except ValueError:
                                    continue
                    except Exception as e:
                        print(f"Error parsing date: {e}")

                    if date:  # If we successfully parsed a date, break
                        break

        # If we still don't have author or date, try to extract using OpenAI
        if not author or not date:
            # Only use AI extraction for substantial content
            if len(content) > 100:
                try:
                    extracted_author, extracted_date = self._extract_metadata_with_ai(
                        title, content[:2000])
                    if not author and extracted_author:
                        author = extracted_author
                    if not date and extracted_date:
                        date = extracted_date
                except Exception as e:
                    print(f"Error extracting metadata with AI: {e}")

        return author, date

    def _extract_metadata_with_ai(self, title: str, content: str) -> Tuple[Optional[str], Optional[datetime]]:
        """Use OpenAI to extract author and publication date from article content"""
        prompt = f"""
Extract the author and publication date from this article text:

Title: {title}

Content: {content}

Return your answer in JSON format with these fields:
{{
    "author": "Author Name or null if not found",
    "date": "YYYY-MM-DD" or null if not found
}}
"""

        try:
            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system", "content": "You extract metadata from article text."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.1,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            # Extract author
            author = result.get("author") if result.get(
                "author") != "null" else None

            # Extract and parse date
            date_str = result.get("date")
            date = None
            if date_str and date_str != "null":
                try:
                    date = datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    print(f"Could not parse date: {date_str}")

            return author, date

        except Exception as e:
            print(f"Error using OpenAI to extract metadata: {e}")
            return None, None

    def _generate_keywords(self, title: str, content: str, summary: str) -> List[str]:
        """Generate 3 relevant keywords for the article using OpenAI"""
        try:
            # Combine title and summary for keyword extraction
            text = f"Title: {title}\nSummary: {summary}\nExcerpt: {content[:500]}..."

            prompt = f"""
Extract exactly 3 relevant keywords from this article that best represent its key topics.
Return only the keywords as a JSON array of strings.
Make each keyword a single word or short phrase (2-3 words maximum).
Focus on specific, meaningful terms rather than generic ones.

Article:
{text}

Output format:
["keyword1", "keyword2", "keyword3"]
"""

            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system",
                        "content": "You extract precise keywords from articles."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100,
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            # Parse the response which should be a JSON array
            result = json.loads(response.choices[0].message.content)

            # Ensure we have an array of keywords
            if isinstance(result, dict) and "keywords" in result:
                keywords = result["keywords"]
            elif isinstance(result, list):
                keywords = result
            else:
                # Fall back to regex extraction if the format is unexpected
                content = response.choices[0].message.content
                keywords = re.findall(r'"([^"]*)"', content)

            # Limit to 3 keywords, normalize casing
            keywords = [k.strip().lower() for k in keywords[:3] if k.strip()]

            # Ensure we have exactly 3 keywords
            while len(keywords) < 3:
                industry_keywords = {
                    Industry.BFSI: ["finance", "banking", "investment"],
                    Industry.RETAIL: ["retail", "ecommerce", "shopping"],
                    Industry.HEALTHCARE: ["healthcare", "medical", "wellness"],
                    Industry.TECHNOLOGY: ["technology", "innovation", "digital"],
                    Industry.OTHER: ["business", "industry", "market"]
                }
                default_keywords = industry_keywords.get(Industry.OTHER)
                for kw in default_keywords:
                    if kw not in keywords:
                        keywords.append(kw)
                        if len(keywords) >= 3:
                            break

            return keywords[:3]

        except Exception as e:
            print(f"Error generating keywords: {e}")
            # Fallback keywords based on industry
            industry_fallbacks = {
                Industry.BFSI: ["finance", "banking", "investment"],
                Industry.RETAIL: ["retail", "ecommerce", "shopping"],
                Industry.HEALTHCARE: ["healthcare", "medical", "wellness"],
                Industry.TECHNOLOGY: ["technology", "innovation", "digital"],
                Industry.OTHER: ["business", "industry", "market"]
            }
            return industry_fallbacks.get(Industry.OTHER)
