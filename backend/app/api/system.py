from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.auth import check_permissions
from app.services.docker_service import DockerService
from app.models.user import User
from app.models.docker_types import SystemInfo

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
