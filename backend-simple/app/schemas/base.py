from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str


class BulkActionRequest(BaseModel):
    entity_ids: list[str]


class BulkDeleteRequest(BulkActionRequest):
    force: bool = False


class BulkRestartRequest(BulkActionRequest):
    pass


class BulkStopRequest(BulkActionRequest):
    force: bool = False


class BulkActionResponse(BaseModel):
    successful: list[str]
    failed: list[str]
    message: str
