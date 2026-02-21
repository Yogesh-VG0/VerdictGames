import redis
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

def cache_response(key: str, data: str, expire_seconds: int = 300):
    redis_client.setex(key, expire_seconds, data)

def get_cached_response(key: str):
    return redis_client.get(key)
