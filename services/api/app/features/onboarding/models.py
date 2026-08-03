"""온보딩 — SQLAlchemy 모델.

MBX 에는 Alembic 이 없고 스키마를 `Base.metadata.create_all` 로 만든다.
create_all 은 **새 테이블만 만들고 기존 테이블은 바꾸지 않는다.** 그래서 설계안이
말한 `users.role` / `users.grade` 를 users 에 컬럼으로 붙이면, 새로 만든 DB 에는
있고 이미 돌아가는 DB 에는 없는 상태가 된다. research_profiles 가 같은 이유로
users 를 건드리지 않고 갈라져 나온 선례가 있어서 여기서도 같은 방식을 따른다.

`user_profiles` 가 users 의 확장이라고 보면 된다 — 1:1, user_id 가 기본키.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base

# 역할
ROLE_STUDENT = "student"
ROLE_MENTOR = "mentor"
ROLE_TEACHER = "teacher"
ROLES = (ROLE_STUDENT, ROLE_MENTOR, ROLE_TEACHER)

# 학년 — 'graduate' 는 졸업/N수. 숫자와 섞이므로 문자열로 통일해 둔다.
GRADES = ("1", "2", "3", "graduate")

# 학과는 최대 3개까지. 더 고르면 피드가 한 분야에 쏠리지 않고 흩어진다.
MAX_MAJORS = 3


class UserProfileRow(Base):
    """users 의 확장 — 역할과 온보딩 상태.

    role 은 지금까지 프런트가 **이메일 문자열로 추측**하던 값이다(admin 이
    들어가면 관리자). 여기 저장된 값이 유일한 근거가 된다.
    """

    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), default=ROLE_STUDENT)

    # ── 학생 ──
    grade: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # 계열. "여러 분야가 궁금해요"를 고르면 쉼표로 이어 붙는다("공학,자연").
    track_group: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # ── 교사 ──
    school: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # 담당 학년 — "1,2" 처럼 여러 개일 수 있어 문자열로 둔다
    teacher_grades: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # 이탈 복구용. 완료하면 None 이 되고, 그 시점이 completed_at 에 남는다.
    step: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserMajorRow(Base):
    """학생이 고른 학과(트랙). 최대 3개.

    research_profiles 는 트랙을 하나만 갖는다(1:1). 그쪽은 기존 화면들이 쓰는
    '대표 학과'로 남겨 두고, 여러 개를 고른 사실은 여기에 담는다.
    """

    __tablename__ = "user_majors"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    track_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MentorProfileRow(Base):
    """멘토의 전공·소속."""

    __tablename__ = "mentor_profiles"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    track_id: Mapped[str] = mapped_column(String(40), default="")
    affiliation: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(16), default="student")  # student | graduate
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ClassroomRow(Base):
    """교사가 만든 학급. join_code 로 학생이 들어온다."""

    __tablename__ = "classrooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(String(36), index=True)
    school: Mapped[str] = mapped_column(String(120), default="")
    name: Mapped[str] = mapped_column(String(80))
    # 사람이 불러 주고 받아 적는 코드라 유일성이 필요하다 (DB 에서 막는다)
    join_code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ClassroomMemberRow(Base):
    """학급 소속. 개인정보로 취급 — 계정 삭제 시 함께 지운다."""

    __tablename__ = "classroom_members"

    classroom_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_classroom_members_user", "user_id"),)
