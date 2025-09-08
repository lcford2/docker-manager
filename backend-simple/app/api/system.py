from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.system_info import SystemInfo
from app.schemas.system_info import SystemInfoResponse
from app.services.auth import verify_token
from app.services.db import get_db
from app.services.docker_stats import stats_collector
from app.utils import timing_decorator

router = APIRouter()
logger = get_logger(__name__)


@router.get("/api/system/info", response_model=SystemInfoResponse)
@timing_decorator(logger=logger)
def get_system_info(
    current_user: str = Depends(verify_token), db: Session = Depends(get_db)
):
    # Try cache first
    cached = stats_collector.get_cached_stats()
    if cached and "system" in cached:
        return cached["system"]

    # Fall back to database
    latest = db.query(SystemInfo).order_by(SystemInfo.timestamp.desc()).first()
    if latest:
        return latest

    # Return empty data if no records
    return SystemInfoResponse(
        containers_running=0,
        containers_total=0,
        images_count=0,
        volumes_count=0,
        networks_count=0,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/api/docker-status")
@timing_decorator(logger=logger)
def docker_status():
    """Check Docker connection status - matches original API"""
    docker_status = stats_collector.get_docker_client_status()
    return docker_status
