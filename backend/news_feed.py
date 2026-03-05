"""
news_feed.py — Crypto news fetcher using CryptoPanic's free public API.
Returns headlines + aggregate sentiment score for the AI engine.
"""
import os
import time
import requests

# CryptoPanic free public API — no key required for basic access
CRYPTOPANIC_URL = "https://cryptopanic.com/api/v1/posts/"

# Optional: set CRYPTOPANIC_KEY env var for higher rate limits
API_KEY = os.environ.get("CRYPTOPANIC_KEY", "")

_cache = {"data": None, "ts": 0}
CACHE_TTL = 300  # 5 minutes


def get_news(currencies: str = "BTC", limit: int = 20) -> dict:
    """
    Fetch latest crypto news headlines.
    Returns news items + a simple sentiment score (-1 to +1).
    """
    now = time.time()
    if _cache["data"] and now - _cache["ts"] < CACHE_TTL:
        return _cache["data"]

    params = {
        "auth_token": API_KEY or "anonymous",
        "currencies": currencies,
        "filter": "hot",
        "kind": "news",
        "public": "true",
    }

    try:
        resp = requests.get(CRYPTOPANIC_URL, params=params, timeout=8)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as e:
        # Fallback — return last cached or empty
        if _cache["data"]:
            return _cache["data"]
        return {"headlines": [], "sentiment": 0.0, "error": str(e)}

    items = raw.get("results", [])
    headlines = []
    bullish = 0
    bearish = 0

    for item in items[:limit]:
        votes = item.get("votes", {})
        bull  = votes.get("liked", 0) + votes.get("positive", 0)
        bear  = votes.get("disliked", 0) + votes.get("negative", 0)
        bullish += bull
        bearish += bear

        # Classify based on votes
        if bull > bear:
            sentiment = "bullish"
        elif bear > bull:
            sentiment = "bearish"
        else:
            sentiment = "neutral"

        headlines.append({
            "title":      item.get("title", ""),
            "url":        item.get("url", ""),
            "source":     item.get("source", {}).get("title", ""),
            "published":  item.get("published_at", ""),
            "sentiment":  sentiment,
            "bull_votes": bull,
            "bear_votes": bear,
        })

    # Aggregate sentiment: +1 = max bullish, -1 = max bearish
    total = bullish + bearish
    sentiment_score = round((bullish - bearish) / max(total, 1), 3)

    result = {
        "headlines":       headlines,
        "sentiment":       sentiment_score,         # -1 to +1
        "sentiment_label": "Bullish" if sentiment_score > 0.1 else "Bearish" if sentiment_score < -0.1 else "Neutral",
        "bull_count":      bullish,
        "bear_count":      bearish,
        "cached_at":       int(now),
    }

    _cache["data"] = result
    _cache["ts"] = now
    return result
