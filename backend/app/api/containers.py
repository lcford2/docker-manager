from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import check_permissions
from app.core.database import get_db
from app.models.docker_types import ContainerBasic, ContainerDetailed
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
    container = await docker_database_service.get_container_by_id(container_id)
    if not container:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Container not found"
        )
    return container


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
    docker_service = DockerService()
    try:
        logs = docker_service.get_container_logs(container_id, tail=tail)
        return {"logs": logs}
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
    if minutes < 1 or minutes > 1440:  # Max 24 hours
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minutes must be between 1 and 1440",
        )

    try:
        metrics_data = await docker_database_service.get_container_metrics_history(
            container_id, minutes
        )

        if not metrics_data:
            # Check if container exists
            container = await docker_database_service.get_container_by_id(container_id)
            if not container:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Container not found",
                )

        return {
            "container_id": container_id,
            "minutes": minutes,
            "data_points": metrics_data,
            "total_points": len(metrics_data),
        }
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error getting metrics history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics history",
        )
