from fastapi import APIRouter

from app.core.profiling import profiler

router = APIRouter()


@router.get("/api/profiler/stats")
async def get_profiler_stats():
    """Get overall profiling statistics"""
    return profiler.get_stats_summary()


@router.get("/api/profiler/endpoint/{endpoint_path:path}")
async def get_endpoint_stats(
    endpoint_path: str,
    # current_user: str = Depends(verify_token)
):
    """Get detailed statistics for a specific endpoint"""
    return profiler.get_endpoint_details(endpoint_path)


@router.get("/api/profiler/endpoints")
# async def list_endpoints(current_user: str = Depends(verify_token)):
async def list_endpoints():
    """List all profiled endpoints"""
    with profiler.lock:
        endpoints = [
            {
                "endpoint": endpoint,
                "total_requests": stats.total_requests,
                "avg_duration_ms": round(stats.avg_duration_ms, 2),
                "error_count": stats.error_count,
            }
            for endpoint, stats in profiler.endpoint_stats.items()
        ]

        return {
            "endpoints": sorted(
                endpoints, key=lambda x: x["avg_duration_ms"], reverse=True
            ),
            "total_endpoints": len(endpoints),
        }


@router.post("/api/profiler/reset")
# async def reset_profiler_stats(current_user: str = Depends(verify_token)):
async def reset_profiler_stats():
    """Reset all profiling statistics (development only)"""
    with profiler.lock:
        profiler.request_profiles.clear()
        profiler.endpoint_stats.clear()

    return {"message": "Profiler statistics reset successfully"}
