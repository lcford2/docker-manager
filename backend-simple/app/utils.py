import asyncio
from functools import wraps
from time import perf_counter_ns


def strip_sha(entity_id):
    if entity_id.startswith("sha256:"):
        return entity_id[7:]
    return entity_id


def timing_decorator(logger=None):
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = perf_counter_ns()
            result = await func(*args, **kwargs)
            end_time = perf_counter_ns()
            execution_time = (end_time - start_time) / 1_000_000
            if logger:
                logger.info(f"{func.__name__}: {execution_time:.3f}ms")
            else:
                print(f"{func.__name__}: {execution_time:.3f}ms")
            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = perf_counter_ns()
            result = func(*args, **kwargs)
            end_time = perf_counter_ns()
            execution_time = (end_time - start_time) / 1_000_000

            if logger:
                logger.info(f"{func.__name__}: {execution_time:.3f}ms")
            else:
                print(f"{func.__name__}: {execution_time:.3f}ms")
            return result

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator
