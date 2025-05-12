# LinkedIn Connector – History, Issues & Paths Forward

_Last updated: 2025-05-12_

---

## 1. Goal

Pull ~50 % of daily articles from LinkedIn so they flow through the existing FastAPI + Celery pipeline alongside Google-News.

## 2. Timeline of Attempts

| Attempt                                                                                                           | Approach                                                                                                                                                                                     | Outcome |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **Selenium + ChromeDriver**<br>Headless Chrome inside Docker.                                                     | Chrome not installed in the slim Python image → driver errors. Installing full Chrome layer made the container nearly 2 GB and still hit detection walls.                                    |
| **Playwright (search page scraping)**<br>Human-like typing, stealth UA, device spoofing, random delays.           | Docker image stayed slim (<550 MB) but LinkedIn blocked login → security-checkpoint page / email code. After removing 2-FA we still hit "Unusual activity" CAPTCHA and obtained **0 posts**. |
| **Playwright (hashtag feeds)**<br>Switched from search results to `https://www.linkedin.com/feed/hashtag/<tag>/`. | Code stable; screenshots stored in `/tmp`. Still **0 posts** because every hashtag page required login and our login flow was blocked.                                                       |
| **Cookie persistence (`/tmp/linkedin_cookies.json`)**                                                             | Helped locally but fresh containers couldn't reuse the cookie; login flow again blocked.                                                                                                     |
| **Long-lived `li_at` cookie injection**                                                                           | Works when the cookie is valid. If the cookie is expired or tied to a different IP LinkedIn returns a redirect loop (`ERR_TOO_MANY_REDIRECTS`).                                              |
| **TOTP-based 2-factor (proposed)**                                                                                | Would bypass e-mail verification by generating 6-digit codes via `pyotp`. Needs `LINKEDIN_TOTP_SECRET` plus valid username/password. Not yet implemented.                                    |

## 3. Why Each Attempt Fails

1. **Selenium / ChromeDriver**  
   • Heavy image, requires extra dependencies.  
   • LinkedIn detects default headless Chrome instantly.

2. **Playwright + Password-only Login**  
   • LinkedIn flags headless logins as "suspicious".  
   • It forces an additional verification step (CAPTCHA / code-by-e-mail) we can't solve automatically.

3. **`li_at` Cookie (works but fragile)**  
   • Cookie becomes invalid when: IP address changes drastically, user logs out in a real browser, or LinkedIn rotates session keys (~30 days).  
   • When invalid, hashtag pages redirect between `/uas/login-checkpoint` and `/feed/hashtag/...` → Playwright throws `ERR_TOO_MANY_REDIRECTS`.

4. **TOTP 2-FA (should work)**  
   • LinkedIn accepts a 6-digit code from an Authenticator app with no CAPTCHA.  
   • Requires storing `LINKEDIN_TOTP_SECRET` and adding a tiny `pyotp` call in the `_login()` routine.

5. **CAPTCHA & Hard Blocks**  
   • Even after TOTP LinkedIn may still serve a picture-select captcha if the IP / UA looks like a bot farm.  
   • Solving those automatically would require paid anti-captcha services or rotating residential proxies.

## 4. Current State (2025-05-12)

- Code lives in `backend/app/feeds/linkedin.py` (hashtag scraper).
- `li_at` cookie injection implemented. Works **only** when cookie is fresh & accepted.
- Worker stores screenshots in `/tmp/linkedin_hashtag_<tag>.png` for debugging.
- No TOTP handling yet; username/password login still hits verification walls.

## 5. Recommended Paths Forward

### A. **Use a Fresh `li_at` Cookie (quick-fix)**

1. Log into LinkedIn in a normal browser.
2. Copy the `li_at` value (Dev-Tools → Application → Cookies).
3. Add to `.env`:
   ```
   LINKEDIN_LI_AT=AAAA... (full value)
   ```
4. Restart `celery-worker`.  
   **Pros:** 2-minute fix. **Cons:** Needs manual refresh every few weeks.

---

### B. **Automated TOTP Flow (robust)**

- Enable "Authenticator App" 2-FA on the LinkedIn account and record the secret (Base-32).
- Store in env: `LINKEDIN_TOTP_SECRET=JBSWY3DPEHPK3PXP`.
- Add `pyotp` to `requirements.txt` and extend `_login()`:
  ```python
  import pyotp, os
  otp = pyotp.TOTP(os.environ["LINKEDIN_TOTP_SECRET"]).now()
  await page.fill('input[name="pin"]', otp)
  ```
- Keep `headless=False` + `--start-maximized` to lower bot-detection score.
  **Pros:** No manual cookie refresh. **Cons:** Still vulnerable to captchas.

---

### C. **Third-Party Scraping APIs**

- PhantomBuster, SerpAPI, Oxylabs LinkedIn API, etc.  
  **Pros:** 100 % compliant with LinkedIn challenges. **Cons:** $$

---

### D. **Residential Proxy + Non-Headless Browser**

- Run Playwright under xvfb (`headless=False`) with a residential IP.  
  **Pros:** Mimics a real user closely. **Cons:** Infrastructure overhead.

## 6. Action Plan Suggestion

1. Implement option **B** (TOTP) — ~20 lines of code, no cost.
2. Keep `li_at` fallback for quick manual override.
3. Re-evaluate after 1-2 weeks of production scraping; escalate to paid API if blocks persist.

## 7. Environment Variables Summary

| Key                    | Purpose                   | Example          |
| ---------------------- | ------------------------- | ---------------- |
| `LINKEDIN_USERNAME`    | (fallback) login email    | user@example.com |
| `LINKEDIN_PASSWORD`    | (fallback) login pwd      | Hunter2!         |
| `LINKEDIN_LI_AT`       | Long-lived session cookie | AQEDAQ…          |
| `LINKEDIN_TOTP_SECRET` | Base-32 secret for OTP    | JBSWY3DPEHPK3PXP |

---

Feel free to update this document as experiments continue. Good luck and happy scraping!

---

## 8. Notes on Scraping **X** (formerly Twitter)

Although this project currently targets LinkedIn, we often get asked how different (or harder) it is to collect posts from X. Below is a condensed cheat-sheet.

### 8.1 Key Challenges

| Pain-Point                            | Details                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **No free, stable API**               | The old v1.1/v2 APIs now require paid plans; free tiers are extremely limited (1 k tweets/month).                      |
| **Aggressive rate-limiting**          | Even with a logged-out _guest_ session X caps requests (~600 tweets/15 min). Excess returns 429 "rate limit exceeded". |
| **Guest token & auth headers**        | Every session needs a fresh `guest_token` plus `authorization: Bearer <hard-coded>` header; both rotate periodically.  |
| **Cloudflare / Akamai bot detection** | Rapid requests, datacenter IPs, or missing TLS fingerprints trigger CAPTCHA / 403.                                     |
| **JavaScript-heavy site**             | Static HTML is minimal; timelines load via internal GraphQL calls that require the above tokens.                       |
| **Legal / TOS**                       | X's terms prohibit scraping without permission; some endpoints display a warning banner.                               |

### 8.2 Approaches & Trade-offs

| Approach                                     | Summary                                                                         | Pros                                                | Cons                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Official Paid API**                        | Apply for _Basic_ / _Pro_ plan.                                                 | Legal, stable, no scraping headaches.               | $$; limited fields unless on higher tiers.                                                |
| **Academic Research API**                    | v2 /full-archive access for approved academic accounts.                         | Huge quota, full history.                           | Requires university affiliation; non-commercial.                                          |
| **Snscrape (web scraper)**                   | Python CLI/lib that reverse-engineers guest APIs.                               | No login; works for public tweets, hashtags, users. | Breaks whenever public endpoints change; subject to rate limits; slower.                  |
| **Browser-automation (Playwright/Selenium)** | Log in, scroll timeline, extract DOM.                                           | Avoids API caps; easier to mimic human.             | Heavy, can still hit bot walls; needs login cookies; screenshot-style fallback for media. |
| **Third-party firehoses**                    | Gnip, Decahose resellers, DataSift, etc.                                        | 100 % coverage, SLAs.                               | $$$$ (enterprise licenses).                                                               |
| **Proxy + rotating guest token**             | Curl internal GraphQL endpoints (`/2/timeline/*`) while rotating proxy & token. | Fast, no JS.                                        | Cat-and-mouse; token derivation changes often.                                            |

### 8.3 Suggested Path for This Project

1. **Start with snscrape** for hashtag & user timelines – simple pip install, no keys required. Save raw JSON so we can replay when rates improve.
2. If volume or reliability becomes critical, budget for the **Official Basic API** (currently $100/month) and use filtered-stream rules.
3. Keep a fallback **Playwright scraper** ready with a residential proxy + logged-in cookie for edge cases (polls, restricted tweets).

### 8.4 Environment Place-holders

| Key                          | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `X_BEARER_TOKEN`             | Hard-coded bearer token for guest API calls (changes periodically). |
| `X_GUEST_COOKIE`             | Long-lived auth cookie from a real browser session.                 |
| `X_API_KEY` / `X_API_SECRET` | Paid API credentials (if subscribed).                               |

Add them to `.env` in the same fashion as LinkedIn secrets.

---
