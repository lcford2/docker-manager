from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str


class BulkDeleteRequest(BaseModel):
    entity_ids: list[str]
    force: bool = False


class BulkDeleteResponse(BaseModel):
    deleted: list[str]
    failed: list[str]
    message: str
