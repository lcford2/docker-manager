from datetime import datetime, timedelta, timezone

import docker
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import ContainerNotFoundError, ContainerOperationError
from app.core.logging import get_logger
from app.schemas.base import BulkDeleteRequest, BulkDeleteResponse
from app.schemas.containers import ContainerResponse
from app.services.auth import verify_token
from app.services.db import ContainerStats, get_db
from app.services.docker_stats import stats_collector
from app.utils import timing_decorator

router = APIRouter()
logger = get_logger(__name__)


@router.get("/api/containers", response_model=list[ContainerResponse])
@timing_decorator(logger=logger)
def get_containers(
    current_user: str = Depends(verify_token), db: Session = Depends(get_db)
):
    # Try cache first
    cached = stats_collector.get_cached_stats()
    if cached and "containers" in cached:
        return cached["containers"]

    # Fall back to database
    containers = db.query(ContainerStats).filter(ContainerStats.is_active).all()
    return containers


@router.get("/api/containers/{container_id}/history")
@timing_decorator(logger=logger)
def get_container_history(
    container_id: str,
    hours: int = 1,
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)

    history = (
        db.query(ContainerStats)
        .filter(
            ContainerStats.id == container_id, ContainerStats.timestamp >= cutoff_time
        )
        .order_by(ContainerStats.timestamp)
        .all()
    )

    return history


@router.delete("/api/containers/{container_id}")
@timing_decorator(logger=logger)
def delete_container(container_id: str, current_user: str = Depends(verify_token)):
    try:
        container = stats_collector.docker_client.containers.get(container_id)
        container.remove()
        logger.info(
            f"Container {container_id} deleted successfully by user {current_user}"
        )
        return {"message": f"Container {container_id} deleted successfully"}
    except docker.errors.NotFound:
        logger.warning(f"Container {container_id} not found for deletion")
        raise ContainerNotFoundError(container_id)
    except docker.errors.APIError as e:
        logger.error(f"Docker API error deleting container {container_id}: {e}")
        raise ContainerOperationError(container_id, "delete", str(e))
    except Exception as e:
        logger.error(f"Unexpected error deleting container {container_id}: {e}")
        raise ContainerOperationError(
            container_id, "delete", "Unexpected error occurred"
        )


@router.post("/api/containers/bulk-delete", response_model=BulkDeleteResponse)
@timing_decorator(logger=logger)
def bulk_delete_containers(
    request: BulkDeleteRequest, current_user: str = Depends(verify_token)
):
    container_service = stats_collector.docker_client.containers
    deleted = []
    failed = []
    for container_id in request.entity_ids:
        try:
            container_service.get(container_id).remove(force=request.force)
            deleted.append(container_id)
        except docker.errors.ContainerNotFound:
            logger.warning(f"Container {container_id} not found")
        except docker.errors.APIError as e:
            logger.error(f"Error deleting container {container_id}: {e}")
            failed.append(container_id)
        except Exception as e:
            logger.error(f"Unexpected error deleting container {container_id}: {e}")
            failed.append(container_id)
    return BulkDeleteResponse(
        deleted=deleted,
        failed=failed,
        message=f"Deleted {len(deleted)}/{len(request.entity_ids)} containers",
    )
