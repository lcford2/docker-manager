from datetime import datetime

from pydantic import BaseModel


class VolumeResponse(BaseModel):
    name: str
    driver: str
    mountpoint: str
    scope: str
    created: datetime
    labels: dict[str, str]
    options: dict[str, str]
