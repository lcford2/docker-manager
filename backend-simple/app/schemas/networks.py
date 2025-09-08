from datetime import datetime

from pydantic import BaseModel


class NetworkResponse(BaseModel):
    id: str
    name: str
    driver: str
    scope: str
    created: datetime
    ipam: dict
    internal: bool
    attachable: bool
