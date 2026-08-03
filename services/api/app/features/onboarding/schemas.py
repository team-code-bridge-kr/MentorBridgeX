"""온보딩 — 요청/응답 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from .models import MAX_MAJORS


class ClassroomOut(BaseModel):
    id: str
    name: str
    school: str = ""
    join_code: str
    member_count: int = 0
    # 학생으로 참여한 학급인지, 내가 만든 학급인지
    owned: bool = False


class StateOut(BaseModel):
    """온보딩 화면이 다시 그려질 때 필요한 전부.

    `step` 은 **서버가 기억하는 마지막 지점**이다. 화면을 닫았다 들어와도
    처음부터 다시 고르지 않게 하려고 단계마다 저장한다.
    """

    role: str | None = None
    grade: str | None = None
    track_group: str | None = None
    majors: list[str] = Field(default_factory=list)
    # 학과를 못 고르겠다고 한 상태. majors 가 빈 것만으로는 "아직 안 골랐다"와
    # 구분되지 않아서 따로 내려준다.
    unsure: bool = False
    step: int = 0
    completed: bool = False
    keyword_count: int = 0

    # 교사 / 멘토
    school: str | None = None
    subject: str | None = None
    teacher_grades: str | None = None
    mentor_track_id: str | None = None
    mentor_affiliation: str | None = None
    mentor_status: str | None = None
    classrooms: list[ClassroomOut] = Field(default_factory=list)


class StatePatchIn(BaseModel):
    """단계마다 바뀐 것만 보낸다 — 보내지 않은 항목은 그대로 둔다.

    `majors` 는 빈 배열도 뜻이 있다("아직 모르겠어요"). 그래서 None 과 [] 를
    구분해야 하고, 기본값을 None 으로 둔다.
    """

    role: str | None = None
    grade: str | None = None
    track_group: str | None = Field(default=None, max_length=120)
    majors: list[str] | None = Field(default=None, max_length=MAX_MAJORS)
    step: int | None = Field(default=None, ge=0, le=9)

    school: str | None = Field(default=None, max_length=120)
    subject: str | None = Field(default=None, max_length=60)
    teacher_grades: str | None = Field(default=None, max_length=40)

    mentor_track_id: str | None = Field(default=None, max_length=40)
    mentor_affiliation: str | None = Field(default=None, max_length=120)
    mentor_status: str | None = Field(default=None, max_length=16)


class KeywordSelectIn(BaseModel):
    """STEP 4 — 세부 관심.

    프리셋에서 고른 것과 직접 적은 것을 나눠 받는다. 저장할 때 source 가
    달라지고(preset/manual), 나중에 트랙을 바꿔도 직접 적은 것은 남아야 한다.
    """

    preset: list[str] = Field(default_factory=list, max_length=80)
    manual: list[str] = Field(default_factory=list, max_length=20)


class PreviewItem(BaseModel):
    id: str
    title: str
    summary: str = ""
    outlet: str = ""
    url: str
    image_url: str | None = None
    kind: str
    published_at: datetime | None = None


class PreviewOut(BaseModel):
    items: list[PreviewItem]
    # 내 키워드로 실제로 걸린 것인지, 아니면 최신글로 대신 채운 것인지.
    # 화면 문구가 달라져야 해서 감추지 않는다.
    matched: bool
    keywords: list[str] = Field(default_factory=list)


class ClassroomCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    school: str = Field(default="", max_length=120)


class ClassroomJoinIn(BaseModel):
    join_code: str = Field(min_length=4, max_length=8)


class ClassroomListOut(BaseModel):
    classrooms: list[ClassroomOut]
