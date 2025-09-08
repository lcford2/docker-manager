from datetime import datetime

from pydantic import BaseModel


class SystemInfoResponse(BaseModel):
    containers_running: int
    containers_total: int
    images_count: int
    volumes_count: int
    networks_count: int
    timestamp: datetime
