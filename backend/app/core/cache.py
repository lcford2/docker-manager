import json
import logging
import time
from functools import wraps
from threading import Lock
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class CacheItem:
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.created_at = time.time()
        self.ttl_seconds = ttl_seconds

    @property
    def is_expired(self) -> bool:
        return time.time() - self.created_at > self.ttl_seconds

    @property
    def age_seconds(self) -> float:
        return time.time() - self.created_at


class InMemoryCache:
    def __init__(self, max_items: int = 1000):
        self._cache: Dict[str, CacheItem] = {}
        self._max_items = max_items
        self._lock = Lock()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "sets": 0,
        }

    def get(self, key: str) -> Optional[Any]:
        """Get item from cache"""
        with self._lock:
            if key not in self._cache:
                self._stats["misses"] += 1
                return None

            item = self._cache[key]
            if item.is_expired:
                del self._cache[key]
                self._stats["misses"] += 1
                return None

            self._stats["hits"] += 1
            return item.value

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        """Set item in cache with TTL"""
        with self._lock:
            # Evict expired items and maintain size limit
            self._evict_expired()
            if len(self._cache) >= self._max_items:
                self._evict_lru()

            self._cache[key] = CacheItem(value, ttl_seconds)
            self._stats["sets"] += 1

    def delete(self, key: str) -> bool:
        """Delete item from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> None:
        """Clear all cache items"""
        with self._lock:
            self._cache.clear()

    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern"""
        with self._lock:
            keys_to_delete = [key for key in self._cache.keys() if pattern in key]
            for key in keys_to_delete:
                del self._cache[key]
            return len(keys_to_delete)

    def _evict_expired(self) -> None:
        """Remove expired items"""
        expired_keys = [key for key, item in self._cache.items() if item.is_expired]
        for key in expired_keys:
            del self._cache[key]
            self._stats["evictions"] += 1

    def _evict_lru(self) -> None:
        """Evict least recently used items to make space"""
        if not self._cache:
            return

        # Simple LRU: remove oldest item
        oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
        del self._cache[oldest_key]
        self._stats["evictions"] += 1

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_requests = self._stats["hits"] + self._stats["misses"]
            hit_rate = self._stats["hits"] / total_requests if total_requests > 0 else 0

            return {
                "size": len(self._cache),
                "max_items": self._max_items,
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "hit_rate": hit_rate,
                "evictions": self._stats["evictions"],
                "sets": self._stats["sets"],
                "expired_items": len(
                    [item for item in self._cache.values() if item.is_expired]
                ),
            }

    def get_info(self) -> Dict[str, Any]:
        """Get detailed cache information"""
        with self._lock:
            items_info = []
            for key, item in self._cache.items():
                items_info.append(
                    {
                        "key": key,
                        "age_seconds": item.age_seconds,
                        "ttl_seconds": item.ttl_seconds,
                        "is_expired": item.is_expired,
                        "size_bytes": len(json.dumps(item.value)) if item.value else 0,
                    }
                )

            return {
                "stats": self.get_stats(),
                "items": items_info,
            }


# Global cache instance
cache = InMemoryCache(max_items=1000)


def cached(key_prefix: str, ttl_seconds: int = 300):
    """Decorator for caching function results"""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = _create_cache_key(key_prefix, func.__name__, args, kwargs)

            # Try to get from cache
            result = cache.get(cache_key)
            if result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return result

            # Call function and cache result
            try:
                result = await func(*args, **kwargs)
                cache.set(cache_key, result, ttl_seconds)
                logger.debug(f"Cache set for {cache_key}")
                return result
            except Exception as e:
                logger.error(f"Error in cached function {func.__name__}: {e}")
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = _create_cache_key(key_prefix, func.__name__, args, kwargs)

            # Try to get from cache
            result = cache.get(cache_key)
            if result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return result

            # Call function and cache result
            try:
                result = func(*args, **kwargs)
                cache.set(cache_key, result, ttl_seconds)
                logger.debug(f"Cache set for {cache_key}")
                return result
            except Exception as e:
                logger.error(f"Error in cached function {func.__name__}: {e}")
                raise

        # Return appropriate wrapper based on function type
        import asyncio

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def _create_cache_key(prefix: str, func_name: str, args: tuple, kwargs: dict) -> str:
    """Create a cache key from function arguments"""
    try:
        # Create a simple key from arguments
        args_str = "_".join(str(arg) for arg in args if arg is not None)
        kwargs_str = "_".join(
            f"{k}_{v}" for k, v in sorted(kwargs.items()) if v is not None
        )

        key_parts = [prefix, func_name]
        if args_str:
            key_parts.append(args_str)
        if kwargs_str:
            key_parts.append(kwargs_str)

        return ":".join(key_parts)
    except Exception as e:
        logger.warning(f"Error creating cache key: {e}")
        return f"{prefix}:{func_name}:error"


def invalidate_docker_cache():
    """Invalidate all Docker-related cache entries"""
    count = 0
    count += cache.invalidate_pattern("docker:")
    count += cache.invalidate_pattern("containers:")
    count += cache.invalidate_pattern("images:")
    count += cache.invalidate_pattern("volumes:")
    count += cache.invalidate_pattern("networks:")
    count += cache.invalidate_pattern("system:")

    if count > 0:
        logger.info(f"Invalidated {count} Docker cache entries")

    return count


def get_cache_status() -> Dict[str, Any]:
    """Get current cache status for monitoring"""
    return cache.get_stats()


def get_cache_info() -> Dict[str, Any]:
    """Get detailed cache information"""
    return cache.get_info()
