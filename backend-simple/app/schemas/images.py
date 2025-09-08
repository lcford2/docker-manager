from pydantic import BaseModel


class ImageResponse(BaseModel):
    id: str
    repository: str
    tag: str
    size: int
    created: str
    virtual_size: int
    repo_tags: list[str]
