from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class SectionType(StrEnum):
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
    # 세특은 한 영역이 아니라 **학년별 과목**이라, 만들 때 어느 과목인지 받아야
    # 한다. 없이 만들면 이름표 없는 세특이 42개 사이에 섞여 어느 과목 것인지
    # 알 수 없다. 나머지 일곱 영역은 학년·과목이 없으므로 비워 둔다.
    subject_id: str | None = Field(default=None, max_length=40)
    period_id: str | None = Field(default=None, max_length=20)


class DocumentPatchRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)


class ImportPdfResponse(BaseModel):
    job_id: str
