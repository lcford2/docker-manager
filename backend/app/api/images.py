from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import check_permissions
from app.core.database import get_db
from app.models.docker_types import (
    FailedImageDelete,
    ImageBulkDeleteRequest,
    ImageBulkDeleteResponse,
    ImageInfo,
)
from app.models.user import User
from app.services.docker_database_service import docker_database_service
from app.services.docker_service import DockerService

router = APIRouter()


@router.get("", response_model=List[ImageInfo])
async def get_images(
    current_user: User = Depends(check_permissions("read")),
    db: Session = Depends(get_db),
):
    """Get list of images"""
    return await docker_database_service.get_images()


@router.delete("/{image_id}")
async def remove_image(
    image_id: str,
    force: bool = Query(False, description="Force remove image"),
    current_user: User = Depends(check_permissions("remove")),
    db: Session = Depends(get_db),
):
    """Remove an image"""
    docker_service = DockerService()
    success, error = docker_service.remove_image(image_id, force)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error or "Failed to remove image",
        )
    return {"message": "Image removed successfully"}


@router.post("/bulk-delete", response_model=ImageBulkDeleteResponse)
async def bulk_remove_images(
    request: ImageBulkDeleteRequest,
    current_user: User = Depends(check_permissions("remove")),
    db: Session = Depends(get_db),
):
    """Remove multiple images"""
    docker_service = DockerService()
    deleted = []
    failed = []
    for image_id in request.image_ids:
        success, error = docker_service.remove_image(image_id, request.force)
        if success:
            deleted.append(image_id)
        else:
            failed.append(
                FailedImageDelete(image_id=image_id, error=error or "Unknown error")
            )

    return ImageBulkDeleteResponse(deleted=deleted, failed=failed)
