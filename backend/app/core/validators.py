import logging
import re
from typing import Any, List

from pydantic import BaseModel, ValidationError, validator

logger = logging.getLogger(__name__)

# Docker ID patterns
# TODO: are these id patterns too restrictive?
DOCKER_ID_PATTERN = re.compile(r"^[a-f0-9]{12,64}$")
DOCKER_SHORT_ID_PATTERN = re.compile(r"^[a-f0-9]{12}$")
DOCKER_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")
DOCKER_IMAGE_TAG_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$")

# Limits for bulk operations
MAX_BULK_OPERATIONS = 50
MAX_HISTORICAL_DAYS = 7
MAX_LOG_LINES = 10000
MIN_LOG_LINES = 1


def validate_docker_id(docker_id: str) -> str:
    """Validate Docker container/image ID format"""
    if not docker_id:
        raise ValidationError("Docker ID cannot be empty")

    # Remove any whitespace
    docker_id = docker_id.strip()

    # Check if it's a valid Docker ID (12-64 hex characters)
    if not DOCKER_ID_PATTERN.match(docker_id) and not DOCKER_SHORT_ID_PATTERN.match(
        docker_id
    ):
        raise ValidationError(f"Invalid Docker ID format: {docker_id}")

    return docker_id


def validate_container_name(name: str) -> str:
    """Validate Docker container name"""
    if not name:
        raise ValidationError("Container name cannot be empty")

    name = name.strip()

    # Remove leading slash if present (Docker adds this)
    if name.startswith("/"):
        name = name[1:]

    if not DOCKER_NAME_PATTERN.match(name):
        raise ValidationError(f"Invalid container name format: {name}")

    return name


def validate_image_reference(image_ref: str) -> str:
    """Validate Docker image reference (repository:tag or ID)"""
    if not image_ref:
        raise ValidationError("Image reference cannot be empty")

    image_ref = image_ref.strip()

    # Check if it's an ID or a repository:tag format
    if not (
        DOCKER_ID_PATTERN.match(image_ref)
        or DOCKER_SHORT_ID_PATTERN.match(image_ref)
        or ":" in image_ref
    ):
        raise ValidationError(f"Invalid image reference format: {image_ref}")

    return image_ref


def validate_bulk_operation_size(items: List[Any]) -> List[Any]:
    """Validate bulk operation doesn't exceed limits"""
    if not items:
        raise ValidationError("Bulk operation cannot be empty")

    if len(items) > MAX_BULK_OPERATIONS:
        raise ValidationError(
            f"Bulk operation too large: {len(items)} > {MAX_BULK_OPERATIONS}"
        )

    return items


def validate_historical_time_range(minutes: int) -> int:
    """Validate historical time range parameters"""
    if minutes < 1:
        raise ValidationError("Time range must be at least 1 minute")

    max_minutes = MAX_HISTORICAL_DAYS * 24 * 60  # Convert days to minutes
    if minutes > max_minutes:
        raise ValidationError(
            f"Time range too large: {minutes} > {max_minutes} minutes"
        )

    return minutes


def validate_log_tail_count(tail: int) -> int:
    """Validate log tail count"""
    if tail < MIN_LOG_LINES:
        raise ValidationError(f"Log tail count too small: {tail} < {MIN_LOG_LINES}")

    if tail > MAX_LOG_LINES:
        raise ValidationError(f"Log tail count too large: {tail} > {MAX_LOG_LINES}")

    return tail


def sanitize_docker_command_arg(arg: str) -> str:
    """Sanitize arguments passed to Docker commands"""
    if not isinstance(arg, str):
        raise ValidationError("Docker command argument must be a string")

    # Remove potentially dangerous characters
    dangerous_chars = ["`", "$", ";", "|", "&", ">", "<", "\n", "\r"]
    for char in dangerous_chars:
        if char in arg:
            raise ValidationError(f"Dangerous character '{char}' found in argument")

    return arg.strip()


def validate_and_sanitize_container_ids(container_ids: List[str]) -> List[str]:
    """Validate and sanitize a list of container IDs"""
    if not container_ids:
        raise ValidationError("Container ID list cannot be empty")

    validate_bulk_operation_size(container_ids)

    validated_ids = []
    for container_id in container_ids:
        try:
            validated_id = validate_docker_id(container_id)
            validated_ids.append(validated_id)
        except ValidationError as e:
            logger.warning(
                f"Invalid container ID in bulk operation: {container_id} - {e}"
            )
            raise ValidationError(f"Invalid container ID: {container_id}")

    return validated_ids


def validate_and_sanitize_image_ids(image_ids: List[str]) -> List[str]:
    """Validate and sanitize a list of image IDs"""
    if not image_ids:
        raise ValidationError("Image ID list cannot be empty")

    validate_bulk_operation_size(image_ids)

    validated_ids = []
    for image_id in image_ids:
        try:
            validated_id = validate_image_reference(image_id)
            validated_ids.append(validated_id)
        except ValidationError as e:
            logger.warning(f"Invalid image ID in bulk operation: {image_id} - {e}")
            raise ValidationError(f"Invalid image ID: {image_id}")

    return validated_ids


class ContainerIdValidator(BaseModel):
    """Pydantic model for container ID validation"""

    container_id: str

    @validator("container_id")
    def validate_container_id(cls, v):
        return validate_docker_id(v)


class BulkContainerValidator(BaseModel):
    """Pydantic model for bulk container operations"""

    container_ids: List[str]
    force: bool = False

    @validator("container_ids")
    def validate_container_ids(cls, v):
        return validate_and_sanitize_container_ids(v)


class BulkImageValidator(BaseModel):
    """Pydantic model for bulk image operations"""

    image_ids: List[str]
    force: bool = False

    @validator("image_ids")
    def validate_image_ids(cls, v):
        return validate_and_sanitize_image_ids(v)


class HistoricalQueryValidator(BaseModel):
    """Pydantic model for historical query parameters"""

    container_id: str
    minutes: int = 60

    @validator("container_id")
    def validate_container_id(cls, v):
        return validate_docker_id(v)

    @validator("minutes")
    def validate_minutes(cls, v):
        return validate_historical_time_range(v)


class LogQueryValidator(BaseModel):
    """Pydantic model for log query parameters"""

    container_id: str
    tail: int = 100

    @validator("container_id")
    def validate_container_id(cls, v):
        return validate_docker_id(v)

    @validator("tail")
    def validate_tail(cls, v):
        return validate_log_tail_count(v)


def safe_validate(validator_class: BaseModel, data: dict) -> dict:
    """Safely validate data with proper error handling"""
    try:
        validated = validator_class(**data)
        return validated.dict()
    except ValidationError as e:
        logger.warning(f"Validation error: {e}")
        raise ValidationError(f"Invalid input: {e}")
    except Exception as e:
        logger.error(f"Unexpected validation error: {e}")
        raise ValidationError(f"Validation failed: {str(e)}")


def get_validation_limits() -> dict:
    """Get current validation limits for monitoring"""
    return {
        "max_bulk_operations": MAX_BULK_OPERATIONS,
        "max_historical_days": MAX_HISTORICAL_DAYS,
        "max_log_lines": MAX_LOG_LINES,
        "min_log_lines": MIN_LOG_LINES,
    }
