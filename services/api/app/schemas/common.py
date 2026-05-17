from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PageMeta(BaseModel):
    cursor: str | None = None
    has_more: bool = False


class PageResponse(BaseModel, Generic[T]):
    data: list[T]
    page: PageMeta = Field(default_factory=PageMeta)


class JobStatus(BaseModel):
    id: str
    status: str
    progress: int = 0
    result: dict | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
