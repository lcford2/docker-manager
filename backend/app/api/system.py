from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import check_permissions
from app.core.cache import get_cache_status
from app.core.database import get_connection_pool_status, get_db, test_connection
from app.core.docker_cli import docker_cli_client
from app.models.docker_types import SystemInfo
from app.models.user import User
from app.services.docker_service import DockerService

router = APIRouter()


@router.get("/info", response_model=SystemInfo)
async def get_system_info(
    current_user: User = Depends(check_permissions("read")),
    db: Session = Depends(get_db),
):
    """Get Docker system information"""
    try:
        docker_service = DockerService()
        system_info = docker_service.get_system_info()
        return system_info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system info: {str(e)}",
        )


@router.get("/health")
async def get_system_health(
    current_user: User = Depends(check_permissions("read")),
    db: Session = Depends(get_db),
):
    """Get comprehensive system health information"""
    try:
        # Test database connection
        db_healthy = test_connection()
        db_pool_status = get_connection_pool_status()

        # Test Docker availability
        docker_available = docker_cli_client.available
        docker_info = docker_cli_client.get_system_info()

        # Get cache status
        cache_status = get_cache_status()

        # Get circuit breaker status
        circuit_breaker_status = {}
        if hasattr(docker_cli_client.get_system_info, "_circuit_breaker"):
            circuit_breaker_status[
                "system_info"
            ] = docker_cli_client.get_system_info._circuit_breaker.get_status()
        if hasattr(docker_cli_client.get_containers, "_circuit_breaker"):
            circuit_breaker_status[
                "containers"
            ] = docker_cli_client.get_containers._circuit_breaker.get_status()
        if hasattr(docker_cli_client.get_all_container_stats, "_circuit_breaker"):
            circuit_breaker_status[
                "stats"
            ] = docker_cli_client.get_all_container_stats._circuit_breaker.get_status()

        return {
            "status": "healthy" if (db_healthy and docker_available) else "degraded",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "components": {
                "database": {
                    "healthy": db_healthy,
                    "pool_status": db_pool_status,
                },
                "docker": {
                    "available": docker_available,
                    "status": docker_info.get("status", "unknown"),
                },
                "cache": {
                    "status": "healthy",
                    "stats": cache_status,
                },
                "circuit_breakers": circuit_breaker_status,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system health: {str(e)}",
        )
