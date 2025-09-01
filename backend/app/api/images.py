from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.api.auth import check_permissions
from app.services.docker_service import DockerService
from app.services.docker_database_service import docker_database_service
from app.models.user import User
from app.models.docker_types import ImageInfo

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
    success = docker_service.remove_image(image_id, force)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to remove image"
        )
    return {"message": "Image removed successfully"}
