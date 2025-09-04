from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import check_permissions
from app.core.database import get_db
from app.core.validators import ValidationError as ValidatorError
from app.core.validators import (
    validate_docker_id,
    validate_historical_time_range,
    validate_log_tail_count,
)
from app.models.docker_types import (
    ContainerBasic,
    ContainerBulkDeleteRequest,
    ContainerBulkDeleteResponse,
    ContainerBulkRestartRequest,
    ContainerBulkRestartResponse,
    ContainerBulkStopRequest,
    ContainerBulkStopResponse,
    ContainerDetailed,
    FailedContainerOperation,
)
from app.models.user import User
from app.services.docker_database_service import docker_database_service
from app.services.docker_service import DockerService

router = APIRouter()


@router.get("", response_model=List[ContainerBasic])
async def get_containers(
    all: bool = True,
    current_user: User = Depends(check_permissions("read")),
    db: Session = Depends(get_db),
):
    """Get list of containers"""
    return await docker_database_service.get_containers(all=all)


@router.get("/{container_id}", response_model=ContainerDetailed)
async def get_container(
    container_id: str,
    current_user: User = Depends(check_permissions("read")),
    db: Session = Depends(get_db),
):
    """Get detailed container information"""
    try:
        validated_id = validate_docker_id(container_id)
        container = await docker_database_service.get_container_by_id(validated_id)
        if not container:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Container not found"
            )
        return container
    except ValidatorError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{container_id}/start")
async def start_container(
    container_id: str,
    current_user: User = Depends(check_permissions("start")),
    db: Session = Depends(get_db),
):
    """Start a container"""
    docker_service = DockerService()
    success = docker_service.start_container(container_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to start container"
        )
    return {"message": "Container started successfully"}


@router.post("/{container_id}/stop")
async def stop_container(
    container_id: str,
    current_user: User = Depends(check_permissions("stop")),
    db: Session = Depends(get_db),
):
    """Stop a container"""
    docker_service = DockerService()
    success = docker_service.stop_container(container_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to stop container"
        )
    return {"message": "Container stopped successfully"}


@router.post("/{container_id}/restart")
async def restart_container(
    container_id: str,
    current_user: User = Depends(check_permissions("restart")),
    db: Session = Depends(get_db),
):
    """Restart a container"""
    docker_service = DockerService()
    success = docker_service.restart_container(container_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to restart container",
        )
    return {"message": "Container restarted successfully"}


@router.delete("/{container_id}")
async def remove_container(
    container_id: str,
    force: bool = Query(False, description="Force remove running container"),
    current_user: User = Depends(check_permissions("remove")),
    db: Session = Depends(get_db),
):
    """Remove a container"""
    docker_service = DockerService()
    success = docker_service.remove_container(container_id, force)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove container",
        )
    return {"message": "Container removed successfully"}


@router.get("/{container_id}/logs")
async def get_container_logs(
    container_id: str,
    tail: int = 100,
    current_user: User = Depends(check_permissions("logs")),
    db: Session = Depends(get_db),
):
    """Get container logs"""
    try:
        validated_id = validate_docker_id(container_id)
        validated_tail = validate_log_tail_count(tail)

        docker_service = DockerService()
        logs = docker_service.get_container_logs(validated_id, tail=validated_tail)
        return {"logs": logs}
    except ValidatorError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get container logs: {str(e)}",
        )


@router.get("/{container_id}/stats")
async def get_container_stats(
    container_id: str,
    current_user: User = Depends(check_permissions("stats")),
    db: Session = Depends(get_db),
):
    """Get container statistics"""
    container = await docker_database_service.get_container_by_id(container_id)
    if not container:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Container not found or stats unavailable",
        )
    return {
        "id": container["id"],
        "name": container["name"],
        "cpu_percent": container["cpu_percent"],
        "memory_usage": container["memory_usage"],
        "memory_limit": container["memory_limit"],
        "memory_percent": container["memory_percent"],
        "network_rx": container["network_rx"],
        "network_tx": container["network_tx"],
        "block_read": container["block_read"],
        "block_write": container["block_write"],
    }


@router.get("/{container_id}/metrics/history")
async def get_container_metrics_history(
    container_id: str,
    minutes: int = 60,
    current_user: User = Depends(check_permissions("stats")),
    db: Session = Depends(get_db),
):
    """Get historical metrics for a container"""
    try:
        validated_id = validate_docker_id(container_id)
        validated_minutes = validate_historical_time_range(minutes)

        metrics_data = await docker_database_service.get_container_metrics_history(
            validated_id, validated_minutes
        )

        if not metrics_data:
            # Check if container exists
            container = await docker_database_service.get_container_by_id(validated_id)
            if not container:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Container not found",
                )

        return {
            "container_id": validated_id,
            "minutes": validated_minutes,
            "data_points": metrics_data,
            "total_points": len(metrics_data),
        }
    except ValidatorError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error getting metrics history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics history",
        )


@router.post("/bulk-stop", response_model=ContainerBulkStopResponse)
async def bulk_stop_containers(
    request: ContainerBulkStopRequest,
    current_user: User = Depends(check_permissions("stop")),
    db: Session = Depends(get_db),
):
    """Stop multiple containers"""
    docker_service = DockerService()
    stopped = []
    failed = []
    for container_id in request.container_ids:
        success = docker_service.stop_container(container_id)
        if success:
            stopped.append(container_id)
        else:
            failed.append(
                FailedContainerOperation(
                    container_id=container_id, error="Failed to stop container"
                )
            )

    return ContainerBulkStopResponse(stopped=stopped, failed=failed)


@router.post("/bulk-restart", response_model=ContainerBulkRestartResponse)
async def bulk_restart_containers(
    request: ContainerBulkRestartRequest,
    current_user: User = Depends(check_permissions("restart")),
    db: Session = Depends(get_db),
):
    """Restart multiple containers"""
    docker_service = DockerService()
    restarted = []
    failed = []
    for container_id in request.container_ids:
        success = docker_service.restart_container(container_id)
        if success:
            restarted.append(container_id)
        else:
            failed.append(
                FailedContainerOperation(
                    container_id=container_id, error="Failed to restart container"
                )
            )

    return ContainerBulkRestartResponse(restarted=restarted, failed=failed)


@router.post("/bulk-delete", response_model=ContainerBulkDeleteResponse)
async def bulk_remove_containers(
    request: ContainerBulkDeleteRequest,
    current_user: User = Depends(check_permissions("remove")),
    db: Session = Depends(get_db),
):
    """Remove multiple containers"""
    docker_service = DockerService()
    deleted = []
    failed = []
    for container_id in request.container_ids:
        success = docker_service.remove_container(container_id, request.force)
        if success:
            deleted.append(container_id)
        else:
            failed.append(
                FailedContainerOperation(
                    container_id=container_id, error="Failed to remove container"
                )
            )

    return ContainerBulkDeleteResponse(deleted=deleted, failed=failed)
