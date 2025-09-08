import logging

from fastapi import Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class DockerManagerException(Exception):
    """Base exception class for Docker Manager"""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ContainerNotFoundError(DockerManagerException):
    def __init__(self, container_id: str):
        super().__init__(f"Container {container_id} not found", 404)


class ContainerOperationError(DockerManagerException):
    def __init__(self, container_id: str, operation: str, details: str):
        super().__init__(
            f"Failed to {operation} container {container_id}: {details}", 400
        )


class DockerConnectionError(DockerManagerException):
    def __init__(self, details: str):
        super().__init__(f"Docker connection error: {details}", 503)


class VolumeNotFoundError(DockerManagerException):
    def __init__(self, volume_name: str):
        super().__init__(f"Volume {volume_name} not found", 404)


class ImageNotFoundError(DockerManagerException):
    def __init__(self, image_name: str):
        super().__init__(f"Image {image_name} not found", 404)


class NetworkNotFoundError(DockerManagerException):
    def __init__(self, network_name: str):
        super().__init__(f"Network {network_name} not found", 404)


# Exception handler for custom exceptions
async def docker_manager_exception_handler(
    request: Request, exc: DockerManagerException
):
    logger.error(f"DockerManager exception: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "type": type(exc).__name__},
    )


# Generic exception handler
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error", "type": "InternalError"},
    )
