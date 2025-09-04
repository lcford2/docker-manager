import asyncio
import logging
import time
from enum import Enum
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerConfig:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 30,
        expected_exception: type = Exception,
        name: str = "CircuitBreaker",
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.name = name


class CircuitBreaker:
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = CircuitState.CLOSED
        self._lock = asyncio.Lock()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""
        async with self._lock:
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self.state = CircuitState.HALF_OPEN
                    logger.info(f"{self.config.name}: Moving to HALF_OPEN state")
                else:
                    raise CircuitBreakerOpenException(
                        f"{self.config.name}: Circuit breaker is OPEN"
                    )

        try:
            result = (
                await func(*args, **kwargs)
                if asyncio.iscoroutinefunction(func)
                else func(*args, **kwargs)
            )
            await self._on_success()
            return result
        except self.config.expected_exception as e:
            await self._on_failure()
            raise e

    async def _on_success(self):
        """Handle successful operation"""
        async with self._lock:
            self.failure_count = 0
            self.last_failure_time = None
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.CLOSED
                logger.info(f"{self.config.name}: Circuit breaker reset to CLOSED")

    async def _on_failure(self):
        """Handle failed operation"""
        async with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.failure_count >= self.config.failure_threshold:
                self.state = CircuitState.OPEN
                logger.error(
                    f"{self.config.name}: Circuit breaker OPENED after "
                    f"{self.failure_count} failures"
                )

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True
        return time.time() - self.last_failure_time >= self.config.recovery_timeout

    @property
    def is_closed(self) -> bool:
        return self.state == CircuitState.CLOSED

    @property
    def is_open(self) -> bool:
        return self.state == CircuitState.OPEN

    @property
    def is_half_open(self) -> bool:
        return self.state == CircuitState.HALF_OPEN

    def get_status(self) -> dict:
        """Get current circuit breaker status"""
        return {
            "name": self.config.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure_time": self.last_failure_time,
            "failure_threshold": self.config.failure_threshold,
            "recovery_timeout": self.config.recovery_timeout,
        }


class CircuitBreakerOpenException(Exception):
    """Exception raised when circuit breaker is open"""

    pass


def circuit_breaker(
    failure_threshold: int = 5,
    recovery_timeout: int = 30,
    expected_exception: type = Exception,
    name: str = None,
):
    """Decorator for circuit breaker pattern"""

    def decorator(func: Callable):
        circuit_name = name or f"{func.__module__}.{func.__name__}"
        config = CircuitBreakerConfig(
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
            expected_exception=expected_exception,
            name=circuit_name,
        )
        breaker = CircuitBreaker(config)

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            return await breaker.call(func, *args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # For sync functions, we need to handle the circuit breaker differently
            if breaker.is_open and not breaker._should_attempt_reset():
                raise CircuitBreakerOpenException(
                    f"{circuit_name}: Circuit breaker is OPEN"
                )

            try:
                result = func(*args, **kwargs)
                # Reset on success
                import asyncio

                try:
                    loop = asyncio.get_event_loop()
                    loop.create_task(breaker._on_success())
                except RuntimeError:
                    # No event loop running, handle synchronously
                    breaker.failure_count = 0
                    breaker.last_failure_time = None
                    if breaker.state == CircuitState.HALF_OPEN:
                        breaker.state = CircuitState.CLOSED
                return result
            except expected_exception as e:
                # Handle failure
                import asyncio

                try:
                    loop = asyncio.get_event_loop()
                    loop.create_task(breaker._on_failure())
                except RuntimeError:
                    # No event loop running, handle synchronously
                    breaker.failure_count += 1
                    breaker.last_failure_time = time.time()
                    if breaker.failure_count >= breaker.config.failure_threshold:
                        breaker.state = CircuitState.OPEN
                raise e

        # Store breaker instance for monitoring
        if asyncio.iscoroutinefunction(func):
            async_wrapper._circuit_breaker = breaker
            return async_wrapper
        else:
            sync_wrapper._circuit_breaker = breaker
            return sync_wrapper

    return decorator
