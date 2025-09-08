from datetime import datetime

from pydantic import BaseModel


class ContainerResponse(BaseModel):
    id: str
    name: str
    status: str
    image: str
    cpu_percent: float
    memory_percent: float
    memory_usage: int
    memory_limit: int
    network_rx: int
    network_tx: int
    block_read: int
    block_write: int
    timestamp: datetime
    is_active: bool
