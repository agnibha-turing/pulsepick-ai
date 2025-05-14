import openai
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import math
import json
import re
from sqlalchemy import func
import logging

from app.db.models import Article, Industry
from app.core.config import settings

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

    def _calculate_persona_relevance_score(self, article: Article, persona: dict) -> float:
        """
        Calculate a persona-based relevance score for the article using OpenAI.

        This measures how relevant the article is to the specific persona based on:
        - Job title relevance
        - Industry alignment
        - Conversation context
        - Company relevance
        - Personality traits

        Returns a score from 0.0 to 1.0, where higher is more relevant.
        """
        # Default score if we can't calculate relevance
        if not article.title or not article.summary:
            return 0.5

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

            # Prepare article content
            article_content = f"Title: {article.title}\nSummary: {article.summary}\nIndustry: {article.industry}"

            # Create a prompt for OpenAI
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

            # Make the OpenAI API call
            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a precision relevance scoring system that evaluates content relevance to specific personas."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0.1  # Low temperature for consistent results
            )

            # Extract the score from the response
            result = response.choices[0].message.content.strip()

            try:
                # Try to convert to float
                relevance_score = float(result)
                # Ensure it's within 0-1 range
                relevance_score = max(0.0, min(1.0, relevance_score))
                return relevance_score
            except ValueError:
                # If conversion fails, use a fallback approach
                logger.warning(
                    f"Failed to parse OpenAI relevance score: {result}")
                # Use a simple fallback for performance reasons when LLM call fails
                return self._calculate_persona_relevance_fallback(article, persona)

        except Exception as e:
            logger.error(
                f"Error calculating persona relevance with OpenAI: {e}")
            # Fallback to simple matching if OpenAI call fails
            return self._calculate_persona_relevance_fallback(article, persona)

    def _calculate_persona_relevance_fallback(self, article: Article, persona: dict) -> float:
        """Fallback method for persona relevance when OpenAI is unavailable."""
        # Extract persona attributes
        recipient_name = persona.get("recipientName", "")
        job_title = persona.get("jobTitle", "")
        company = persona.get("company", "")
        conversation_context = persona.get("conversationContext", "")

        # Initialize component scores
        job_title_score = 0.0
        company_score = 0.0
        context_score = 0.0
        industry_score = 0.0

        # Combine article contents for analysis
        article_content = f"{article.title}. {article.summary}".lower()

        # 1. Calculate job title relevance
        if job_title:
            # Check if job title or related terms appear in content
            job_terms = self._extract_job_role_terms(job_title)
            matches = sum(1 for term in job_terms if term.lower()
                          in article_content)
            job_title_score = min(1.0, matches / max(1, len(job_terms)))

        # 2. Calculate company relevance
        if company:
            # Simple check for company name mention
            if company.lower() in article_content:
                company_score = 1.0
            else:
                # Check for industry terms related to the company
                company_terms = company.lower().split()
                matches = sum(1 for term in company_terms if len(
                    term) > 3 and term in article_content)
                company_score = min(0.7, matches / max(1, len(company_terms)))

        # 3. Calculate conversation context relevance
        if conversation_context:
            # Extract key terms from conversation context
            context_terms = conversation_context.lower().split()
            significant_terms = [
                term for term in context_terms if len(term) > 3]

            if significant_terms:
                matches = sum(
                    1 for term in significant_terms if term in article_content)
                context_score = min(
                    1.0, matches / max(1, len(significant_terms) * 0.5))

        # 4. Calculate industry alignment
        if article.industry and job_title:
            # Extract industry from job title or company
            persona_industry = self._infer_industry_from_text(
                f"{job_title} {company}")

            if persona_industry and persona_industry == article.industry:
                industry_score = 1.0
            else:
                industry_score = 0.3  # Some baseline relevance for any industry

        # Weight the different components
        weights = {
            "job_title": 0.25,
            "company": 0.15,
            "context": 0.4,
            "industry": 0.2
        }

        persona_score = (
            job_title_score * weights["job_title"] +
            company_score * weights["company"] +
            context_score * weights["context"] +
            industry_score * weights["industry"]
        )

        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, persona_score))

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

    def calculate_combined_relevance_score(self, article: Article, persona: dict = None) -> float:
        """
        Calculate a combined relevance score factoring in both recency and persona relevance.

        If persona is provided, the formula is:
        final_score = (w1 * recency_score) + (w2 * persona_relevance_score)

        If no persona is provided, return just the recency score.
        """
        # Calculate recency score (time-based relevance)
        recency_score = self._calculate_relevance_score(article)

        # If no persona is provided, return just the recency score
        if not persona:
            return recency_score

        # Calculate persona-based relevance using LLM only
        # We're skipping the fallback method for accuracy
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

            # Prepare article content
            article_content = f"Title: {article.title}\nSummary: {article.summary}\nIndustry: {article.industry}"

            # Create a prompt for OpenAI
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

            # Make the OpenAI API call
            response = self.openai_client.chat.completions.create(
                model=settings.OPENAI_COMPLETION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a precision relevance scoring system that evaluates content relevance to specific personas."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0.1  # Low temperature for consistent results
            )

            # Extract the score from the response
            result = response.choices[0].message.content.strip()

            try:
                # Try to convert to float
                persona_score = float(result)
                # Ensure it's within 0-1 range
                persona_score = max(0.0, min(1.0, persona_score))
            except ValueError:
                # If conversion fails, log the error and use a default score
                logger.warning(
                    f"Failed to parse OpenAI relevance score: {result}")
                persona_score = 0.5  # Use middle value as default

        except Exception as e:
            logger.error(
                f"Error calculating persona relevance with OpenAI: {e}")
            # Use middle value as default in case of errors
            persona_score = 0.5

        # Weights for combining scores
        w1 = 0.3  # Weight for recency
        w2 = 0.7  # Weight for persona relevance

        # Calculate combined score
        final_score = (w1 * recency_score) + (w2 * persona_score)

        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, final_score))

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
