# backend/app/feeds/linkedin.py

import os
import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from playwright.async_api import async_playwright, Browser, Page
from sqlalchemy.orm import Session

from app.feeds.base import BaseConnector
from app.db.models import SourceType, Industry


class LinkedInConnector(BaseConnector):
    """Simplified connector for scraping LinkedIn hashtag posts."""

    BASE_URL = "https://www.linkedin.com"
    LOGIN_URL = f"{BASE_URL}/login"
    HASHTAG_URL = f"{BASE_URL}/feed/hashtag"

    def __init__(self, db: Session, credentials: Dict[str, str] = None):
        super().__init__(db, SourceType.LINKEDIN)
        self.credentials = credentials or {}
        self.logger = logging.getLogger("linkedin_connector")
        self.cookies_path = "/tmp/linkedin_cookies.json"

        # Optional long-lived auth cookie (preferred over headless login)
        # Set LINKEDIN_LI_AT in the environment to skip the login flow and avoid security challenges.
        self.li_at: str | None = os.getenv("LINKEDIN_LI_AT")

        # Default hashtags by industry
        self.hashtags = {
            Industry.TECHNOLOGY: ["artificialintelligence", "generativeai", "machinelearning"],
            Industry.RETAIL: ["ecommerce", "retailtech", "shoppinginnovation"],
            Industry.HEALTHCARE: ["healthcare", "medtech", "telemedicine"],
            Industry.BFSI: ["fintech", "insurtech", "bankinginnovation"],
            Industry.OTHER: ["digitaltransformation", "enterpriseai"]
        }

    async def _setup(self) -> (Browser, Page):
        pw = await async_playwright().start()
        browser = await pw.chromium.launch(headless=True, args=[
            "--no-sandbox", "--disable-blink-features=AutomationControlled"
        ])
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            storage_state=self.cookies_path if os.path.exists(
                self.cookies_path) else None
        )

        # If we have a supplied li_at cookie and no saved storage_state yet, inject the cookie now.
        if self.li_at and not os.path.exists(self.cookies_path):
            await context.add_cookies([
                {
                    "name": "li_at",
                    "value": self.li_at,
                    "domain": ".linkedin.com",
                    "path": "/",
                    "httpOnly": True,
                    "secure": True,
                }
            ])
            # Persist for future runs to avoid injecting repeatedly.
            await context.storage_state(path=self.cookies_path)

        page = await context.new_page()
        return browser, page

    async def _login(self, page: Page) -> bool:
        """Return True if already logged in (via cookies), otherwise perform login."""
        if self.li_at:
            self.logger.info(
                "Using li_at cookie – attempting direct feed access")
            await page.goto(f"{self.BASE_URL}/feed", timeout=60000)
            try:
                await page.wait_for_selector(
                    "div.feed-identity-module, button.share-box-feed-entry__trigger",
                    timeout=8000,
                )
                self.logger.info(
                    "li_at cookie validated – authenticated session active")
                return True
            except Exception:
                self.logger.warning(
                    "li_at cookie present but feed not accessible – cookie may be invalid; will try credential login"
                )

        # Attempt feed access without cookie or after failed cookie validation – may still be logged in via saved storage_state.
        await page.goto(f"{self.BASE_URL}/feed", timeout=60000)

        # Heuristic: look for an element that only appears for logged-in users.
        try:
            await page.wait_for_selector(
                "div.feed-identity-module, button.share-box-feed-entry__trigger",
                timeout=5000,
            )
            # Already logged in – nothing else to do.
            return True
        except Exception:
            # Not logged in – fall through to credential sign-in.
            pass

        # If we reach here we're not logged in yet. If no credentials are configured, abort.
        if not self.credentials.get("username") or not self.credentials.get("password"):
            self.logger.error(
                "No LinkedIn credentials available and li_at cookie did not authenticate.")
            return False

        # Go to the dedicated login page and authenticate with credentials.
        await page.goto(self.LOGIN_URL, timeout=60000)
        await page.fill('input[name="session_key"], input#username', self.credentials["username"])
        await page.fill('input[name="session_password"], input#password', self.credentials["password"])
        await page.click('button[type="submit"]')

        # Wait until the feed appears to confirm we are logged in.
        try:
            await page.wait_for_selector(
                "div.feed-identity-module, button.share-box-feed-entry__trigger",
                timeout=15000,
            )
            # Persist cookies so subsequent sessions can reuse them.
            await page.context.storage_state(path=self.cookies_path)
            return True
        except Exception:
            self.logger.error(
                "Login failed or timed out – unable to locate feed after authentication.")
            return False

    async def _scrape_hashtag(self, page: Page, hashtag: str, industry: str, max_posts: int) -> List[Dict[str, Any]]:
        url = f"{self.HASHTAG_URL}/{hashtag}/"
        self.logger.info(
            f"Scraping LinkedIn hashtag: #{hashtag} for industry {industry}")
        await page.goto(url, timeout=60000)
        await asyncio.sleep(2 + random.random())

        # Scroll to load posts
        for _ in range(3):
            await page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
            await asyncio.sleep(1 + random.random())

        # Extract post elements – try multiple selectors to account for LinkedIn markup variations.
        posts = await page.query_selector_all("div.occludable-update")

        # If nothing found yet, wait briefly and retry with alternative selectors.
        if not posts:
            try:
                await page.wait_for_selector(
                    "div.feed-shared-update-v2, div.occludable-update", timeout=5000
                )
            except Exception:
                pass  # we'll still attempt to query regardless of wait outcome

            posts = await page.query_selector_all(
                "div.feed-shared-update-v2, div.occludable-update"
            )

        self.logger.info(f"Found {len(posts)} posts for #{hashtag}")

        # Take a screenshot for debugging
        screenshot_path = f"/tmp/linkedin_hashtag_{hashtag}.png"
        await page.screenshot(path=screenshot_path)

        results = []
        for post in posts[:max_posts]:
            try:
                # Extract text content
                text_content = await post.inner_text()
                if not text_content or len(text_content.strip()) < 10:
                    continue

                # Extract link - can be null
                link_element = await post.query_selector("a")
                link = await link_element.get_attribute("href") if link_element else None

                # Extract author name
                author_element = await post.query_selector("span.feed-shared-actor__name, .update-components-actor__name")
                author = await author_element.inner_text() if author_element else "Unknown LinkedIn User"

                # Try to get timestamp
                time_element = await post.query_selector("span.feed-shared-actor__sub-description time, .update-components-actor__sub-description time")
                timestamp = await time_element.get_attribute("datetime") if time_element else None

                # Parse date or use now
                if timestamp:
                    try:
                        published_at = datetime.fromisoformat(
                            timestamp.replace('Z', '+00:00'))
                    except:
                        published_at = datetime.now() - timedelta(days=random.randint(0, 3))
                else:
                    published_at = datetime.now() - timedelta(days=random.randint(0, 3))

                # Create source for this hashtag
                source_id = self._get_source_id(industry, hashtag)

                # Create structured post data
                lines = text_content.strip().split('\n')
                title = next((line for line in lines if len(
                    line.strip()) > 5), f"LinkedIn post #{hashtag}")

                post_data = {
                    'source_id': source_id,
                    'title': title[:200],  # Limit title length
                    'url': link or url,
                    'author': author,
                    'published_at': published_at,
                    'content': text_content[:1000],  # Limit content length
                    'raw_json': {
                        'title': title[:200],
                        'url': link or url,
                        'author': author,
                        'date': published_at.isoformat(),
                        'content': text_content[:1000],
                        'industry': industry,
                        'hashtag': hashtag,
                        'source_type': 'linkedin'
                    }
                }

                results.append(post_data)
                self.logger.debug(f"Extracted post: {title[:50]}...")

            except Exception as e:
                self.logger.error(f"Error extracting post data: {e}")
                continue

        return results

    def _get_source_id(self, industry: str, hashtag: str) -> int:
        """Get or create a source for LinkedIn hashtag"""
        source_name = f"LinkedIn - {industry} - #{hashtag}"
        source_url = f"{self.HASHTAG_URL}/{hashtag}/"
        source_description = f"LinkedIn #{hashtag} posts for {industry} industry"

        source = self.get_or_create_source(
            name=source_name,
            url=source_url,
            description=source_description
        )

        return source.id

    async def _fetch(self, since: datetime, limit: int) -> List[Dict[str, Any]]:
        browser, page = await self._setup()
        try:
            if not await self._login(page):
                self.logger.error("LinkedIn login failed. Cannot fetch posts.")
                return []

            # Calculate posts per tag to distribute evenly
            total_tags = sum(len(tags) for tags in self.hashtags.values())
            posts_per_tag = max(limit // total_tags, 1)

            all_posts = []
            for industry, tags in self.hashtags.items():
                if len(all_posts) >= limit:
                    break

                # Use up to 2 hashtags per industry to avoid rate limiting
                for tag in tags[:2]:
                    if len(all_posts) >= limit:
                        break

                    # Add random delay between hashtags
                    await asyncio.sleep(random.uniform(2, 5))

                    # Scrape posts from this hashtag
                    posts = await self._scrape_hashtag(page, tag, industry, posts_per_tag)

                    # Filter by date if needed
                    if since:
                        filtered_posts = [p for p in posts if p.get(
                            'published_at') and p['published_at'] >= since]
                        if filtered_posts:
                            all_posts.extend(filtered_posts)
                        else:
                            # If all filtered out, keep a few recent ones anyway
                            all_posts.extend(posts[:min(2, len(posts))])
                    else:
                        all_posts.extend(posts)

                    self.logger.info(f"Fetched {len(posts)} posts for #{tag}")

            return all_posts[:limit]

        except Exception as e:
            self.logger.error(f"Error fetching LinkedIn posts: {e}")
            return []

        finally:
            await browser.close()

    def fetch_articles(self, since: Optional[datetime] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Main method to fetch LinkedIn posts from hashtags"""
        since = since or (datetime.now() - timedelta(days=7))

        try:
            return asyncio.run(self._fetch(since, limit))
        except Exception as e:
            self.logger.error(f"Error in fetch_articles: {e}")
            return []

    def fetch_since(self, days: int = 7, limit: int = 50) -> List[Dict[str, Any]]:
        """Compatibility method to match the API used by other connectors"""
        since_date = datetime.now() - timedelta(days=days)
        return self.fetch_articles(since=since_date, limit=limit)
