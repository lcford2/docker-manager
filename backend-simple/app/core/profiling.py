import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Optional

import psutil
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RequestProfile:
    """Profile data for a single request"""

    path: str
    method: str
    status_code: int
    duration_ms: float
    timestamp: datetime
    memory_before_mb: float
    memory_after_mb: float
    memory_delta_mb: float
    user: Optional[str] = None


@dataclass
class EndpointStats:
    """Aggregated statistics for an endpoint"""

    total_requests: int = 0
    total_duration_ms: float = 0.0
    min_duration_ms: float = float("inf")
    max_duration_ms: float = 0.0
    avg_duration_ms: float = 0.0
    recent_requests: deque = field(default_factory=lambda: deque(maxlen=100))
    error_count: int = 0


class ProfilerMiddleware(BaseHTTPMiddleware):
    """Middleware to profile API requests"""

    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled
        self.request_profiles: deque = deque(maxlen=1000)  # Keep last 1000 requests
        self.endpoint_stats: Dict[str, EndpointStats] = defaultdict(EndpointStats)
        self.lock = threading.RLock()

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        # Get memory before request
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024  # MB

        # Track timing
        start_time = time.perf_counter()

        # Process request
        response: Response = await call_next(request)

        # Calculate metrics
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000

        # Get memory after request
        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        memory_delta = memory_after - memory_before

        # Extract user from request if available
        user = None
        if hasattr(request.state, "user"):
            user = request.state.user

        # Create profile
        profile = RequestProfile(
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=duration_ms,
            timestamp=datetime.now(),
            memory_before_mb=memory_before,
            memory_after_mb=memory_after,
            memory_delta_mb=memory_delta,
            user=user,
        )

        # Store profile data
        with self.lock:
            self.request_profiles.append(profile)

            # Update endpoint stats
            endpoint_key = f"{request.method} {request.url.path}"
            stats = self.endpoint_stats[endpoint_key]
            stats.total_requests += 1
            stats.total_duration_ms += duration_ms
            stats.min_duration_ms = min(stats.min_duration_ms, duration_ms)
            stats.max_duration_ms = max(stats.max_duration_ms, duration_ms)
            stats.avg_duration_ms = stats.total_duration_ms / stats.total_requests
            stats.recent_requests.append(profile)

            if response.status_code >= 400:
                stats.error_count += 1

        # Log slow requests
        if duration_ms > 1000:  # Log requests taking more than 1 second
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {duration_ms:.1f}ms (status: {response.status_code})"
            )
        elif settings.debug:
            logger.debug(
                f"Request: {request.method} {request.url.path} "
                f"took {duration_ms:.1f}ms (status: {response.status_code})"
            )

        return response

    def get_stats_summary(self) -> Dict:
        """Get summary of profiling statistics"""
        with self.lock:
            if not self.request_profiles:
                return {"message": "No requests profiled yet"}

            # Overall stats
            total_requests = len(self.request_profiles)
            avg_duration = (
                sum(p.duration_ms for p in self.request_profiles) / total_requests
            )

            # Recent performance (last 10 minutes)
            recent_cutoff = datetime.now() - timedelta(minutes=10)
            recent_profiles = [
                p for p in self.request_profiles if p.timestamp > recent_cutoff
            ]

            # Top slowest endpoints
            sorted_endpoints = sorted(
                self.endpoint_stats.items(),
                key=lambda x: x[1].avg_duration_ms,
                reverse=True,
            )

            return {
                "total_requests": total_requests,
                "avg_duration_ms": round(avg_duration, 2),
                "recent_requests_10min": len(recent_profiles),
                "slowest_endpoints": [
                    {
                        "endpoint": endpoint,
                        "avg_duration_ms": round(stats.avg_duration_ms, 2),
                        "total_requests": stats.total_requests,
                        "error_count": stats.error_count,
                        "max_duration_ms": round(stats.max_duration_ms, 2),
                    }
                    for endpoint, stats in sorted_endpoints[:10]
                ],
                "recent_slow_requests": [
                    {
                        "path": p.path,
                        "method": p.method,
                        "duration_ms": round(p.duration_ms, 2),
                        "status_code": p.status_code,
                        "timestamp": p.timestamp.isoformat(),
                        "memory_delta_mb": round(p.memory_delta_mb, 2),
                    }
                    for p in sorted(
                        recent_profiles, key=lambda x: x.duration_ms, reverse=True
                    )[:10]
                ],
            }

    def get_endpoint_details(self, endpoint: str) -> Dict:
        """Get detailed stats for a specific endpoint"""
        with self.lock:
            if endpoint not in self.endpoint_stats:
                return {"error": f"Endpoint '{endpoint}' not found"}

            stats = self.endpoint_stats[endpoint]
            recent_requests = list(stats.recent_requests)

            return {
                "endpoint": endpoint,
                "total_requests": stats.total_requests,
                "avg_duration_ms": round(stats.avg_duration_ms, 2),
                "min_duration_ms": round(stats.min_duration_ms, 2),
                "max_duration_ms": round(stats.max_duration_ms, 2),
                "error_count": stats.error_count,
                "error_rate": round((stats.error_count / stats.total_requests) * 100, 2)
                if stats.total_requests > 0
                else 0,
                "recent_requests": [
                    {
                        "duration_ms": round(req.duration_ms, 2),
                        "status_code": req.status_code,
                        "timestamp": req.timestamp.isoformat(),
                        "memory_delta_mb": round(req.memory_delta_mb, 2),
                        "user": req.user,
                    }
                    for req in recent_requests[-20:]  # Last 20 requests
                ],
            }


# Global profiler instance
profiler = ProfilerMiddleware(app=None, enabled=settings.debug)
