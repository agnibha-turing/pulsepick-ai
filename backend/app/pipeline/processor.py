import math
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, timezone
import logging
import json
import re
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI, AsyncOpenAI
from sqlalchemy import func
from app.db.models import Article, Industry
from app.core.config import settings
from sqlalchemy.orm import Session

# Set up logger
logger = logging.getLogger(__name__)


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
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def process_articles(self, articles: List[Dict[str, Any]]) -> List[Article]:
        """
        Process a batch of articles through the full pipeline

        Args:
            articles: List of article dictionaries to process

        Returns:
            List of Article objects that were successfully processed and saved
        """
        processed_articles = []
        # Track URLs we've seen in this batch to avoid duplicates within the batch
        processed_urls = set()

        for article_data in articles:
            try:
                # Normalize URL for comparison (lowercase, remove trailing slashes)
                original_url = article_data['url']
                normalized_url = original_url.lower().rstrip('/')

                # Skip if we've already processed this URL in the current batch
                if normalized_url in processed_urls:
                    logger.info(
                        f"Skipping duplicate URL in batch: {original_url}")
                    continue

                # Check if article with this URL already exists in database (deduplication)
                # Use SQL LIKE with pattern to handle trailing slashes
                url_pattern = original_url.rstrip('/') + '%'
                existing = self.db.query(Article).filter(
                    func.lower(Article.url).like(func.lower(url_pattern))).first()

                if not existing:
                    # Double check with exact match as fallback
                    existing = self.db.query(Article).filter(
                        Article.url == original_url).first()

                if existing:
                    logger.info(
                        f"Skipping existing article in database: {original_url}")
                    continue

                # Add to our processed URLs set
                processed_urls.add(normalized_url)

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

                # Extract keywords
                article.keywords = self._extract_keywords(
                    article.title, article.content or "", article.summary or "")

                # Generate embeddings for vector search
                article.embedding = self._generate_embedding(
                    f"{article.title}. {article.summary or article.content or ''}"
                )

                # Calculate relevance score
                article.relevance_score = self._calculate_relevance_score(
                    article)

                # Save to database with explicit try/except for DB constraints
                try:
                    self.db.add(article)
                    self.db.commit()
                    self.db.refresh(article)
                    processed_articles.append(article)
                    logger.info(
                        f"Successfully saved article: {article.title[:50]}")
                except Exception as db_error:
                    self.db.rollback()
                    # If it's a duplicate constraint, log as info not warning
                    if "unique_article_url" in str(db_error):
                        logger.info(
                            f"Duplicate URL detected: {article.url}")
                    else:
                        # For other database errors, log as warning
                        logger.warning(
                            f"Database error saving article '{article.title[:50]}': {db_error}")
                        # Re-raise non-duplicate errors
                        raise

            except Exception as e:
                # Log error but continue with other articles
                logger.warning(
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
            logger.error(f"Error generating summary: {e}")
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
            logger.error(f"Error classifying industry: {e}")
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
            logger.error(f"Error generating embedding: {e}")
            # Return zero vector as fallback
            return [0.0] * settings.OPENAI_EMBEDDING_DIMENSIONS

    def _calculate_relevance_score(self, article: Article) -> float:
        """
        Calculate a relevance score for the article based solely on recency.

        Formula: score = recency_score
        - A fresh article (0 days) has recency_score 1.0
        - A 1-day old article has recency_score ~0.6
        - A 3-day old article has recency_score ~0.22
        """
        # Base recency score
        recency_score = 0.0
        if article.published_at:
            # Ensure both dates are timezone-aware for comparison
            now = datetime.now(timezone.utc)
            pub_date = article.published_at
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=timezone.utc)

            days_old = (now - pub_date).days
            decay_factor = 0.5  # Controls how quickly relevance decays with age
            recency_score = math.exp(-decay_factor * max(0, days_old))

        # Return just the recency score without industry weighting
        return recency_score

    def _calculate_persona_relevance_batch(self, articles: List[Article], persona: dict) -> List[float]:
        """
        Calculate relevance scores for multiple articles using concurrent API calls.
        This is much more efficient than making individual sequential API calls.

        Args:
            articles: List of articles to score
            persona: Persona data for scoring

        Returns:
            List of relevance scores in the same order as the input articles
        """
        if not articles:
            return []

        try:
            # Extract persona attributes
            recipient_name = persona.get("recipientName", "")
            job_title = persona.get("jobTitle", "")
            company = persona.get("company", "")
            conversation_context = persona.get("conversationContext", "")
            personality_traits = persona.get("personalityTraits", "")

            # Create a combined description of the persona
            persona_description = f"Recipient: {recipient_name}\n"
            if job_title:
                persona_description += f"Job title: {job_title}\n"
            if company:
                persona_description += f"Company: {company}\n"
            if conversation_context:
                persona_description += f"Previous conversation context: {conversation_context}\n"
            if personality_traits:
                persona_description += f"Personality traits: {personality_traits}\n"

            # Prepare article contents and prompts
            prompts = []

            for article in articles:
                article_content = f"Title: {article.title}\nSummary: {article.summary}\nIndustry: {article.industry}"

                prompt = f"""
                I need to determine how relevant an article is to a specific person.
                
                PERSONA INFORMATION:
                {persona_description}
                
                ARTICLE CONTENT:
                {article_content}
                
                Consider the following aspects:
                1. How relevant is this article to the person's job role and responsibilities?
                2. How relevant is this article to the person's company or industry?
                3. How well does this article connect to their previous conversation context?
                4. Would this content be valuable to this specific person?
                
                Return a relevance score between 0.0 and 1.0 where:
                - 0.0 means completely irrelevant
                - 1.0 means extremely relevant and perfectly aligned with their interests
                
                Output only the numerical score (e.g., 0.87) without any explanation or additional text.
                """

                prompts.append((article, prompt))

            # Calculate scores with concurrent requests
            scores = []
            start_time = time.time()
            logger.info(f"Starting batch scoring of {len(articles)} articles")

            # Process in smaller concurrent batches for better throughput
            batch_size = 5  # Process 5 articles concurrently
            for i in range(0, len(prompts), batch_size):
                batch_prompts = prompts[i:i+batch_size]
                batch_scores = self._process_prompts_concurrently(
                    batch_prompts)
                scores.extend(batch_scores)

            end_time = time.time()
            logger.info(
                f"Completed batch scoring in {end_time - start_time:.2f} seconds")

            return scores

        except Exception as e:
            logger.error(f"Error in batch persona relevance scoring: {e}")
            # Return default scores
            return [0.5] * len(articles)

    def _process_prompts_concurrently(self, batch_prompts) -> List[float]:
        """
        Process a batch of prompts concurrently using ThreadPoolExecutor.

        Args:
            batch_prompts: List of (article, prompt) tuples

        Returns:
            List of scores
        """
        scores = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for article, prompt in batch_prompts:
                futures.append(executor.submit(
                    self._score_single_article, prompt))

            # Collect results in order
            for future in futures:
                try:
                    score = future.result()
                    scores.append(score)
                except Exception as e:
                    logger.error(f"Error scoring article: {e}")
                    # Use a default score on error
                    scores.append(0.5)

        return scores

    def _score_single_article(self, prompt: str) -> float:
        """Score a single article using OpenAI API"""
        try:
            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a precision relevance scoring system that evaluates content relevance to specific personas."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0.1
            )

            # Extract the score from the response
            result = response.choices[0].message.content.strip()
            try:
                # Try to convert to float
                score = float(result)
                # Ensure it's within 0-1 range
                score = max(0.0, min(1.0, score))
                return score
            except ValueError:
                logger.warning(
                    f"Failed to parse OpenAI relevance score: {result}")
                return 0.5

        except Exception as e:
            logger.error(f"Error in single article scoring: {e}")
            return 0.5

    def calculate_combined_relevance_scores_batch(self, articles: List[Article], persona: dict = None) -> List[float]:
        """
        Calculate combined relevance scores for multiple articles in a batch.

        Args:
            articles: List of articles to score
            persona: Persona data for personalization

        Returns:
            List of combined relevance scores
        """
        if not articles:
            return []

        # Calculate recency scores for all articles
        recency_scores = [self._calculate_relevance_score(
            article) for article in articles]

        # If no persona provided, return just the recency scores
        if not persona:
            return recency_scores

        # Get persona relevance scores using batch API
        persona_scores = self._calculate_persona_relevance_batch(
            articles, persona)

        # Weights for combining scores
        w1 = 0.3  # Weight for recency
        w2 = 0.7  # Weight for persona relevance

        # Calculate combined scores
        combined_scores = []
        for i in range(len(articles)):
            recency_score = recency_scores[i]
            persona_score = persona_scores[i] if i < len(
                persona_scores) else 0.5

            # Calculate combined score
            final_score = (w1 * recency_score) + (w2 * persona_score)

            # Ensure score is between 0 and 1
            final_score = max(0.0, min(1.0, final_score))
            combined_scores.append(final_score)

        return combined_scores

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
                                    parsed_date = datetime.strptime(
                                        date_str, fmt)
                                    # Add timezone info if missing
                                    if parsed_date.tzinfo is None:
                                        parsed_date = parsed_date.replace(
                                            tzinfo=timezone.utc)
                                    date = parsed_date
                                    break
                                except ValueError:
                                    continue
                    except Exception as e:
                        logger.warning(f"Error parsing date: {e}")

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
                    logger.error(f"Error extracting metadata with AI: {e}")

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
                    # Parse the date and ensure it's timezone-aware (UTC)
                    date = datetime.strptime(
                        date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                except ValueError:
                    logger.warning(f"Could not parse date: {date_str}")

            return author, date

        except Exception as e:
            logger.error(f"Error using OpenAI to extract metadata: {e}")
            return None, None

    def _extract_keywords(self, title: str, content: str, summary: str) -> List[str]:
        """Extract 3 relevant keywords from the article using OpenAI"""
        try:
            # Combine title and summary for keyword extraction
            text = f"Title: {title}\nSummary: {summary}\nExcerpt: {content[:500]}..."

            # More explicit prompt with instructions for concise keywords
            prompt = f"""Extract exactly 3 most relevant keywords from this article.
Return ONLY the 3 keywords separated by commas, without numbering, explanation, or additional text.

IMPORTANT: Use common acronyms and shorter forms when appropriate:
- Use "AI" instead of "Artificial Intelligence"
- Use "ML" instead of "Machine Learning"
- Use "NLP" instead of "Natural Language Processing"
- Use "UI/UX" instead of "User Interface/User Experience"
- Keep keywords brief and concise

Example: "AI, Fraud Detection, Banking" instead of "Artificial Intelligence, Fraud Detection Systems, Banking Industry"

Article:
{text}"""

            # Add more detailed logging
            logger.debug(
                f"Sending keyword extraction prompt for: {title[:30]}...")

            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a keyword extraction tool. Output ONLY concise keywords separated by commas. Use acronyms when possible."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=50,
                temperature=0.3  # Lower temperature for more deterministic response
            )

            keywords_text = response.choices[0].message.content.strip()
            logger.debug(f"Raw keyword response: {keywords_text}")

            # More robust parsing
            # First, try comma separation
            keywords = [k.strip() for k in keywords_text.split(',')]

            # If we don't have enough keywords, try other separators
            if len(keywords) < 3:
                keywords = [k.strip() for k in keywords_text.split('\n')]

            # Clean up any empty strings
            keywords = [k for k in keywords if k]

            # Ensure we have exactly 3 keywords
            if len(keywords) > 3:
                keywords = keywords[:3]
            while len(keywords) < 3:
                keywords.append(f"Topic {len(keywords)+1}")  # Better fallback

            logger.debug(f"Extracted keywords: {keywords}")
            return keywords

        except Exception as e:
            logger.error(f"Error extracting keywords: {e}")
            # Return default keywords on failure
            return ["AI", "Technology", "News"]

    def calculate_combined_relevance_score(self, article: Article, persona: dict = None) -> float:
        """
        Calculate a combined relevance score factoring in both recency and persona relevance.

        This is a compatibility method that uses the batch scoring internally.
        If persona is provided, the formula is:
        final_score = (w1 * recency_score) + (w2 * persona_relevance_score)

        If no persona is provided, return just the recency score.
        """
        # If no persona provided, use just the recency score
        if not persona:
            return self._calculate_relevance_score(article)

        # Use the batch scoring method with a single article
        scores = self.calculate_combined_relevance_scores_batch(
            [article], persona)

        # Return the score or a default if something went wrong
        if scores and len(scores) > 0:
            return scores[0]
        else:
            # Fallback to calculating just recency score in case of error
            logger.warning(
                "Batch scoring failed, falling back to recency score")
            return self._calculate_relevance_score(article)

    def _calculate_persona_relevance_score(self, article: Article, persona: dict) -> float:
        """
        Calculate a persona-based relevance score for the article.

        This is now a compatibility method that uses the batch processing internally.

        Returns a score from 0.0 to 1.0, where higher is more relevant.
        """
        # Default score if we can't calculate relevance
        if not article.title or not article.summary:
            return 0.5

        # Use the batch method with a single article
        scores = self._calculate_persona_relevance_batch([article], persona)

        # Return the score or a default if something went wrong
        if scores and len(scores) > 0:
            return scores[0]
        else:
            return 0.5  # Default score

    def _calculate_persona_relevance_fallback(self, article: Article, persona: dict) -> float:
        """
        Simple fallback method for persona relevance using keyword matching.

        This provides a basic score when batch processing fails.
        """
        # Extract persona attributes
        job_title = persona.get("jobTitle", "").lower()
        company = persona.get("company", "").lower()
        industry = persona.get("industry", "").lower()

        # Combine article content
        article_content = f"{article.title} {article.summary}".lower()

        # Count simple matches
        score = 0.0
        matches = 0

        # Check for job title keywords
        if job_title and any(word for word in job_title.split() if len(word) > 3 and word in article_content):
            matches += 1

        # Check for company name
        if company and company in article_content:
            matches += 1

        # Check for industry match
        if industry and industry in article_content:
            matches += 1

        # Check for article industry
        if article.industry and industry and article.industry == industry:
            matches += 1

        # Simple scoring based on matches
        if matches > 0:
            score = min(1.0, matches / 4.0)
        else:
            score = 0.3  # Base score for any article

        return score

    def _extract_job_role_terms(self, job_title: str) -> list:
        """Extract relevant terms from a job title for matching."""
        # Common job title components
        common_roles = [
            "manager", "director", "executive", "analyst", "specialist",
            "engineer", "developer", "architect", "consultant", "advisor",
            "officer", "lead", "head", "chief", "vp", "president", "ceo", "cto", "cio"
        ]

        # Common industries/departments
        common_departments = [
            "sales", "marketing", "product", "engineering", "development", "finance",
            "hr", "operations", "research", "strategy", "technology", "it", "security",
            "data", "analytics", "customer", "support", "service", "business", "legal"
        ]

        job_title_lower = job_title.lower()
        terms = job_title_lower.split()

        # Add original terms
        result = [term for term in terms if len(term) > 2]

        # Add matched roles and departments
        for role in common_roles:
            if role in job_title_lower and role not in result:
                result.append(role)

        for dept in common_departments:
            if dept in job_title_lower and dept not in result:
                result.append(dept)

        return result

    def _infer_industry_from_text(self, text: str) -> str:
        """Infer industry from text (job title, company, etc.)"""
        text_lower = text.lower()

        industry_keywords = {
            "bfsi": ["bank", "finance", "insurance", "wealth", "investment", "trading", "fintech"],
            "retail": ["retail", "ecommerce", "shop", "store", "consumer", "merchandise"],
            "technology": ["tech", "software", "hardware", "cloud", "saas", "digital", "computer", "it"],
            "healthcare": ["health", "medical", "pharma", "biotech", "hospital", "clinic", "patient"],
            "other": []
        }

        for industry, keywords in industry_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return industry

        return "other"
