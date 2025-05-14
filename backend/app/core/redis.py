import redis
from app.core.config import settings

# Redis client singleton
_redis_client = None


def get_redis_client():
    """
    Returns a Redis client instance.
    Uses a singleton pattern to avoid creating multiple connections.
    """
    global _redis_client

    if _redis_client is None:
        redis_url = settings.REDIS_URL
        _redis_client = redis.from_url(redis_url)

    return _redis_client
