from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import openai
import logging
from app.core.config import settings
from app.db.session import get_db
from sqlalchemy.orm import Session
import time
from cachetools import TTLCache

router = APIRouter()
logger = logging.getLogger(__name__)

# Cache for storing generated messages to reduce API calls
# TTL of 15 minutes, max size of 100 items
message_cache = TTLCache(maxsize=100, ttl=900)


class Article(BaseModel):
    id: str
    title: str
    summary: List[str]
    categories: List[str]
    source: str
    keywords: Optional[List[str]] = []


class Persona(BaseModel):
    recipientName: Optional[str] = None
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    conversationContext: Optional[str] = None
    personalityTraits: Optional[str] = None


class MessageRequest(BaseModel):
    articles: List[Article]
    persona: Optional[Persona] = None
    platform: str  # "email", "linkedin", "twitter", "slack"
    regenerate: bool = False  # Force regeneration instead of cache


class MessageResponse(BaseModel):
    message: str
    cached: bool = False


@router.post("/generate", response_model=MessageResponse)
async def generate_message(
    request: MessageRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Generate a personalized message for the selected articles and persona.
    Supports different platforms: email, linkedin, twitter, slack
    """
    try:
        # Create a cache key based on articles, persona and platform
        cache_key = f"{'-'.join([a.id for a in request.articles])}-{request.platform}"
        if request.persona and request.persona.recipientName:
            cache_key += f"-{request.persona.recipientName}"

        # Return cached response if available and not forcing regeneration
        if cache_key in message_cache and not request.regenerate:
            return MessageResponse(message=message_cache[cache_key], cached=True)

        # Initialize OpenAI client
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        # Construct the prompt based on platform and persona
        prompt = construct_prompt(
            request.articles, request.persona, request.platform)

        # Call OpenAI API
        response = client.chat.completions.create(
            model=settings.OPENAI_COMPLETION_MODEL,
            messages=[
                {"role": "system", "content": "You are a professional content writer specializing in creating personalized business messages."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000,
        )

        # Extract the generated message
        message = response.choices[0].message.content.strip()

        # Cache the result
        message_cache[cache_key] = message

        # Log usage in background to avoid blocking the response
        background_tasks.add_task(log_message_generation,
                                  article_ids=[a.id for a in request.articles],
                                  platform=request.platform,
                                  persona_name=request.persona.recipientName if request.persona else None)

        return MessageResponse(message=message, cached=False)

    except Exception as e:
        logger.error(f"Error generating message: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate message: {str(e)}")


def construct_prompt(articles: List[Article], persona: Optional[Persona], platform: str) -> str:
    """Construct a prompt for the message generation based on platform and persona"""

    # Basic article information
    article_info = ""
    for i, article in enumerate(articles, 1):
        article_info += f"Article {i}: {article.title}\n"
        article_info += f"Summary: {article.summary[0]}\n"
        article_info += f"Categories: {', '.join(article.categories)}\n"
        if article.keywords:
            article_info += f"Keywords: {', '.join(article.keywords)}\n"
        article_info += "\n"

    # Persona information
    persona_info = "No specific recipient information provided."
    persona_style_guidance = ""
    direct_content_guidance = ""
    has_persona = False

    if persona:
        has_persona = True
        persona_info = f"Recipient: {persona.recipientName or 'Unnamed'}"
        if persona.jobTitle:
            persona_info += f", {persona.jobTitle}"
        if persona.company:
            persona_info += f" at {persona.company}"
        persona_info += "\n"

        # Direct content personalization guidance
        if persona.recipientName:
            direct_content_guidance += f"- Address the message directly to {persona.recipientName} by name\n"

        if persona.jobTitle:
            direct_content_guidance += f"- Make direct reference to their role as {persona.jobTitle}"
            if persona.company:
                direct_content_guidance += f" at {persona.company}"
            direct_content_guidance += "\n"
            direct_content_guidance += f"- Highlight aspects of the articles most relevant to someone in their position\n"

        if persona.company:
            direct_content_guidance += f"- Where appropriate, connect insights to potential impacts for {persona.company} or similar organizations\n"

        if persona.conversationContext:
            persona_info += f"Previous conversation context: {persona.conversationContext}\n"
            direct_content_guidance += f"- Make explicit reference to your previous conversation about {persona.conversationContext}\n"
            direct_content_guidance += f"- Connect the article content to this previous discussion\n"

        # Enhanced personality traits handling
        if persona.personalityTraits:
            persona_info += f"Personality traits: {persona.personalityTraits}\n"

            # Add specific style guidance based on personality traits
            traits_lower = persona.personalityTraits.lower()

            if "humor" in traits_lower or "funny" in traits_lower or "jovial" in traits_lower:
                persona_style_guidance += "- Include subtle humor or lighthearted elements appropriate for a business context\n"

            if "serious" in traits_lower or "formal" in traits_lower or "professional" in traits_lower:
                persona_style_guidance += "- Maintain a more formal, professional tone without casual language\n"

            if "analytical" in traits_lower or "detail" in traits_lower or "thorough" in traits_lower:
                persona_style_guidance += "- Include specific details and data points from the articles\n"

            if "brief" in traits_lower or "concise" in traits_lower or "direct" in traits_lower:
                persona_style_guidance += "- Keep the message exceptionally concise and to the point\n"

            if "visual" in traits_lower or "creative" in traits_lower:
                persona_style_guidance += "- Use more descriptive language and metaphors where appropriate\n"

    # Platform-specific instructions
    platform_instructions = {
        "email": (
            "Create a professional email that summarizes the key points from these articles. "
            "Use a formal business tone with a clear subject line, greeting, body, and sign-off. "
            "Format the message as 'Subject: [subject]\n\n[email body]'"
        ),
        "linkedin": (
            "Write a LinkedIn post highlighting insights from these articles. "
            "Use a professional but conversational tone. Include relevant hashtags. "
            "Keep it concise (under 1300 characters) and engaging for a professional audience."
        ),
        "twitter": (
            "Create a Twitter/X post about these articles. "
            "Be extremely concise (under 280 characters). "
            "Include relevant hashtags and make it attention-grabbing."
        ),
        "slack": (
            "Write a message for Slack that shares these article insights. "
            "Use a casual, friendly tone with some Slack-appropriate formatting (like *bold* or _italic_). "
            "Keep it conversational but informative."
        )
    }

    # Full prompt
    prompt = f"""Generate a personalized message for the following articles:

{article_info}

Recipient Information:
{persona_info}

Platform: {platform.upper()}
{platform_instructions.get(platform.lower(), "Create a professional message based on these articles.")}

{"IMPORTANT - Direct message personalization:\n" + direct_content_guidance if direct_content_guidance else ""}
{"Writing style guidance based on recipient personality:\n" + persona_style_guidance if persona_style_guidance else ""}

Make the message sound natural, personalized, and engaging. The personalization should be integrated naturally 
into the message - not just mentioning their name, but truly tailoring the content to them.

{f"THE FINAL MESSAGE MUST CLEARLY BE FOR {persona.recipientName} SPECIFICALLY, NOT A GENERIC MESSAGE." if has_persona and persona.recipientName else ""}
"""
    return prompt


def log_message_generation(article_ids: List[str], platform: str, persona_name: Optional[str] = None):
    """Log message generation for analytics purposes"""
    try:
        # Here you would typically save to a database
        # For now, just log it
        logger.info(f"Message generated for articles {article_ids} on {platform}" +
                    (f" for {persona_name}" if persona_name else ""))
    except Exception as e:
        logger.error(f"Error logging message generation: {e}")
