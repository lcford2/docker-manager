from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import check_permissions
from app.core.database import get_db
from app.models.docker_types import VolumeInfo
from app.models.user import User
from app.services.docker_database_service import docker_database_service

router = APIRouter()


@router.get("", response_model=List[VolumeInfo])
async def get_volumes(
    current_user: User = Depends(check_permissions("read")),
    db: Session = Depends(get_db),
):
    """Get list of volumes"""
    return await docker_database_service.get_volumes()


@router.get("/{volume_name}/inspect")
async def inspect_volume(
    volume_name: str,
    current_user: User = Depends(check_permissions("inspect")),
    db: Session = Depends(get_db),
):
    """Get detailed volume information"""
    volume_data = await docker_database_service.get_volume_by_id(volume_name)
    if not volume_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found"
        )
    return volume_data
