import docker
from fastapi import APIRouter, Depends

from app.core.exceptions import DockerConnectionError, ImageNotFoundError
from app.core.logging import get_logger
from app.schemas.base import BulkActionResponse, BulkDeleteRequest
from app.schemas.images import ImageResponse
from app.services.auth import verify_token
from app.services.docker_stats import stats_collector
from app.utils import strip_sha, timing_decorator

router = APIRouter()
logger = get_logger(__name__)


@router.get("/api/images", response_model=list[ImageResponse])
@timing_decorator(logger=logger)
def get_images(current_user: str = Depends(verify_token)):
    """Get Docker images - simple implementation"""
    try:
        images_data = stats_collector.docker_client.images.list()
        images = []
        for img in images_data:
            # Get the first tag or use "none"
            repo_tags = img.tags if img.tags else ["<none>:<none>"]
            first_tag = repo_tags[0]

            if ":" in first_tag:
                repository, tag = first_tag.rsplit(":", 1)
            else:
                repository, tag = first_tag, "latest"

            # TODO: SEND MORE STATS
            images.append(
                ImageResponse(
                    id=strip_sha(img.id),
                    repository=repository,
                    tag=tag,
                    size=img.attrs.get("Size", 0),
                    created=img.attrs.get("Created", ""),
                    virtual_size=img.attrs.get("VirtualSize", img.attrs.get("Size", 0)),
                    repo_tags=img.tags or [],
                )
            )
        return images
    except Exception as e:
        logger.error(f"Error fetching images: {e}")
        return []


@router.delete("/api/images/{image_id}")
@timing_decorator(logger=logger)
def delete_image(image_id: str, current_user: str = Depends(verify_token)):
    try:
        image = stats_collector.docker_client.images.get(image_id)
        image.remove()
        logger.info(f"Image {image_id} deleted successfully by user {current_user}")
        return {"message": f"Image {image_id} deleted successfully"}
    except docker.errors.ImageNotFound:
        logger.warning(f"Image {image_id} not found for deletion")
        raise ImageNotFoundError(image_id)
    except docker.errors.APIError as e:
        logger.error(f"Docker API error deleting image {image_id}: {e}")
        raise DockerConnectionError(f"Failed to delete image {image_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error deleting image {image_id}: {e}")
        raise DockerConnectionError(f"Unexpected error deleting image {image_id}")


@router.post("/api/images/pull")
@timing_decorator(logger=logger)
def pull_image(
    image_name: str,
    current_user: str = Depends(verify_token),
):
    image_service = stats_collector.docker_client.images
    try:
        image_service.pull(image_name)
        return {"message": f"Image {image_name} pulled successfully"}
    except docker.errors.APIError as e:
        logger.error(f"Error pulling image {image_name}: {e}")
        raise DockerConnectionError(f"Failed to pull image {image_name}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error pulling image {image_name}: {e}")
        raise DockerConnectionError(f"Unexpected error pulling image {image_name}")


@router.get("/api/images/{image_id}/inspect")
def inspect_image(image_id: str, current_user: str = Depends(verify_token)):
    image_service = stats_collector.docker_client.images
    try:
        image = image_service.get(image_id)
        return image.attrs
    except docker.errors.ImageNotFound:
        logger.warning(f"Image {image_id} not found")
        raise ImageNotFoundError(f"Image {image_id} not found")
    except docker.errors.APIError as e:
        logger.error(f"Error inspecting image {image_id}: {e}")
        raise DockerConnectionError(f"Failed to inspect image {image_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error inspecting image {image_id}: {e}")
        raise DockerConnectionError(f"Unexpected error inspecting image {image_id}")


@router.post("/api/images/bulk-delete", response_model=BulkActionResponse)
@timing_decorator(logger=logger)
def bulk_delete_images(
    request: BulkDeleteRequest, current_user: str = Depends(verify_token)
):
    image_service = stats_collector.docker_client.images
    successful = []
    failed = []
    for image_id in request.entity_ids:
        try:
            image_service.get(image_id).remove(force=request.force)
            successful.append(image_id)
        except docker.errors.ImageNotFound:
            logger.warning(f"Image {image_id} not found")
        except docker.errors.APIError as e:
            logger.error(f"Error deleting image {image_id}: {e}")
            failed.append(image_id)
        except Exception as e:
            logger.error(f"Unexpected error deleting image {image_id}: {e}")
            failed.append(image_id)
    return BulkActionResponse(
        successful=successful,
        failed=failed,
        message=f"Deleted {len(successful)}/{len(request.entity_ids)} images",
    )
