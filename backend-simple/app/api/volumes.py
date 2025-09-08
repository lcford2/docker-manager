import docker
from fastapi import APIRouter, Depends

from app.core.exceptions import DockerConnectionError, VolumeNotFoundError
from app.core.logging import get_logger
from app.schemas.base import BulkActionResponse, BulkDeleteRequest
from app.schemas.volumes import VolumeResponse
from app.services.auth import verify_token
from app.services.docker_stats import stats_collector
from app.utils import timing_decorator

router = APIRouter()
logger = get_logger(__name__)


@router.get("/api/volumes", response_model=list[VolumeResponse])
@timing_decorator(logger=logger)
def get_volumes(current_user: str = Depends(verify_token)):
    """Get Docker volumes - simple implementation"""
    try:
        volumes_data = stats_collector.docker_client.volumes.list()
        volumes = []
        for vol in volumes_data:
            volumes.append(
                VolumeResponse(
                    name=vol.name,
                    driver=getattr(
                        vol.attrs.get("Driver"),
                        "name",
                        vol.attrs.get("Driver", "local"),
                    ),
                    mountpoint=vol.attrs.get("Mountpoint", ""),
                    scope=vol.attrs.get("Scope", "local"),
                    created=vol.attrs.get("CreatedAt", ""),
                    labels=vol.attrs.get("Labels") or {},
                    options=vol.attrs.get("Options") or {},
                )
            )
        return volumes
    except Exception as e:
        logger.error(f"Error fetching volumes: {e}")
        return []


@router.delete("/api/volumes/{volume_id}")
@timing_decorator(logger=logger)
def delete_volume(volume_id: str, current_user: str = Depends(verify_token)):
    try:
        volume = stats_collector.docker_client.volumes.get(volume_id)
        volume.remove()
        logger.info(f"Volume {volume_id} deleted successfully by user {current_user}")
        return {"message": f"Volume {volume_id} deleted successfully"}
    except docker.errors.NotFound:
        logger.warning(f"Volume {volume_id} not found for deletion")
        raise VolumeNotFoundError(volume_id)
    except docker.errors.APIError as e:
        logger.error(f"Docker API error deleting volume {volume_id}: {e}")
        raise DockerConnectionError(f"Failed to delete volume {volume_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error deleting volume {volume_id}: {e}")
        raise DockerConnectionError(f"Unexpected error deleting volume {volume_id}")


@router.post("/api/volumes")
@timing_decorator(logger=logger)
def create_volume(
    name: str,
    driver: str = "local",
    labels: dict | None = None,
    current_user: str = Depends(verify_token),
):
    """Create a new Docker volume"""
    try:
        volume_config = {"Name": name, "Driver": driver}
        if labels:
            volume_config["Labels"] = labels

        volume = stats_collector.docker_client.volumes.create(**volume_config)
        logger.info(f"Volume {name} created successfully by user {current_user}")

        return VolumeResponse(
            name=volume.name,
            driver=getattr(
                volume.attrs.get("Driver"),
                "name",
                volume.attrs.get("Driver", "local"),
            ),
            mountpoint=volume.attrs.get("Mountpoint", ""),
            scope=volume.attrs.get("Scope", "local"),
            created=volume.attrs.get("CreatedAt", ""),
            labels=volume.attrs.get("Labels") or {},
            options=volume.attrs.get("Options") or {},
        )
    except docker.errors.APIError as e:
        logger.error(f"Docker API error creating volume {name}: {e}")
        raise DockerConnectionError(f"Failed to create volume {name}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error creating volume {name}: {e}")
        raise DockerConnectionError(f"Unexpected error creating volume {name}")


@router.get("/api/volumes/{volume_name}/inspect")
async def inspect_volume(volume_name: str):
    try:
        volume = stats_collector.docker_client.volumes.get(volume_name)
        return VolumeResponse(
            id=volume.id,
            name=volume.name,
            driver=volume.attrs.get("Driver", ""),
            mountpoint=volume.attrs.get("Mountpoint", ""),
            scope=volume.attrs.get("Scope", "local"),
            created=volume.attrs.get("CreatedAt", ""),
            labels=volume.attrs.get("Labels") or {},
            options=volume.attrs.get("Options") or {},
        )
    except docker.errors.APIError as e:
        logger.error(f"Docker API error inspecting volume {volume_name}: {e}")
        raise DockerConnectionError(f"Failed to inspect volume {volume_name}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error inspect volume {volume_name}: {e}")
        raise DockerConnectionError(f"Unexpected error inspecting volume {volume_name}")


@router.get("/api/volumes/{volume_name}/inspect")
@router.post("/api/volumes/bulk-delete", response_model=BulkActionResponse)
@timing_decorator(logger=logger)
def bulk_delete_volumes(
    request: BulkDeleteRequest, current_user: str = Depends(verify_token)
):
    volume_service = stats_collector.docker_client.volumes
    successful = []
    failed = []
    for volume_id in request.entity_ids:
        try:
            volume_service.get(volume_id).remove()
            successful.append(volume_id)
        except docker.errors.VolumeNotFound:
            logger.warning(f"Volume {volume_id} not found")
        except docker.errors.APIError as e:
            logger.error(f"Error deleting volume {volume_id}: {e}")
            failed.append(volume_id)
        except Exception as e:
            logger.error(f"Unexpected error deleting volume {volume_id}: {e}")
            failed.append(volume_id)
    return BulkActionResponse(
        successful=successful,
        failed=failed,
        message=f"Deleted {len(successful)}/{len(request.entity_ids)} volumes",
    )
