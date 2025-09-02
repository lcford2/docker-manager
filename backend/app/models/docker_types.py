from datetime import datetime
from typing import Any, Dict

from pydantic import BaseModel


class ContainerBasic(BaseModel):
    id: str
    name: str
    status: str
    image: str
    created: str
    ports: Dict[str, Any]


class ContainerDetailed(ContainerBasic):
    inspect: Dict[str, Any]
    logs: str


class ContainerStats(BaseModel):
    id: str
    name: str
    cpu_percent: float
    memory_usage: int
    memory_limit: int
    memory_percent: float
    network_rx: int
    network_tx: int
    block_read: int
    block_write: int


class ContainerStatsEnhanced(ContainerStats):
    status: str
    uptime: str
    uptime_seconds: int
    timestamp: str


class VolumeInfo(BaseModel):
    name: str
    driver: str
    mountpoint: str
    created: str
    labels: Dict[str, str]
    options: Dict[str, str]
    scope: str


class ImageInfo(BaseModel):
    id: str
    repository: str
    tag: str
    size: int
    created: str
    virtual_size: int


class ImageBulkDeleteRequest(BaseModel):
    image_ids: list[str]
    force: bool = False


class FailedImageDelete(BaseModel):
    image_id: str
    error: str


class ImageBulkDeleteResponse(BaseModel):
    deleted: list[str]
    failed: list[FailedImageDelete]


class NetworkInfo(BaseModel):
    id: str
    name: str
    driver: str
    scope: str
    created: str
    containers: Dict[str, Any]


class SystemInfo(BaseModel):
    containers_running: int
    containers_paused: int
    containers_stopped: int
    images: int
    server_version: str
    total_memory: int
    cpus: int


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any]
