from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.api.auth import check_permissions
from app.services.docker_database_service import docker_database_service
from app.models.user import User
from app.models.docker_types import NetworkInfo

router = APIRouter()


@router.get("", response_model=List[NetworkInfo])
async def get_networks(
    current_user: User = Depends(check_permissions("read")),
    db: Session = Depends(get_db),
):
    """Get list of networks"""
    return await docker_database_service.get_networks()
