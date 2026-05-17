from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SectionType(str, Enum):
    SUBJECT_SPECIFIC = "subject_specific"
    AUTONOMOUS = "autonomous"
    CLUB = "club"
    VOLUNTEER = "volunteer"
    CAREER = "career"
    BEHAVIOR = "behavior"
    READING = "reading"
    AWARD = "award"


class DocumentSection(BaseModel):
    id: str
    section_type: SectionType
    content: str
    period_id: str | None = None
    subject_id: str | None = None
    version: int = 1
    source: str = "manual"
    created_at: datetime
    updated_at: datetime


class DocumentCreateRequest(BaseModel):
    section_type: SectionType
    content: str = Field(..., min_length=1, max_length=50000)


class DocumentPatchRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)


class ImportPdfResponse(BaseModel):
    job_id: str
