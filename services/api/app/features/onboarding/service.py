"""다른 모듈이 온보딩 상태를 물어볼 때 쓰는 최소 조회.

라우터가 아니라 여기 두는 이유: auth 라우터가 로그인 응답에 역할을 담아야 하는데,
그것 하나 때문에 온보딩 라우터(피드 쿼리까지 끌고 온다)를 import 하게 만들고
싶지 않다. 여기는 모델만 본다.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..research.models import ResearchProfileRow
from .models import UserProfileRow


@dataclass(frozen=True)
class LoginState:
    """로그인 응답에 실어 보낼 온보딩 요약.

    role 이 **None 이면 "서버가 모른다"** 는 뜻이다. 기본값 "student" 를 돌려주지
    않는 이유: 프런트에는 아직 이메일로 역할을 추측하던 데모 경로가 남아 있다.
    서버가 모르는 것을 학생이라고 단정하면 기존 교사 데모 계정이 조용히 학생이 된다.
    """

    role: str | None = None
    grade: str | None = None
    onboarded: bool = False


async def login_state(session: AsyncSession | None, user_id: str) -> LoginState:
    if session is None:
        return LoginState()
    row = await session.get(UserProfileRow, user_id)
    if row is not None and row.completed_at is not None:
        return LoginState(role=row.role, grade=row.grade, onboarded=True)

    # 온보딩이 생기기 전에 이미 학과를 고른 사람은 끝낸 것으로 본다.
    # 쓰던 사람을 다시 처음 화면으로 돌려보내지 않기 위해서다.
    legacy = await session.scalar(
        select(ResearchProfileRow.user_id).where(ResearchProfileRow.user_id == user_id)
    )
    return LoginState(
        role=row.role if row else None,
        grade=row.grade if row else None,
        onboarded=legacy is not None,
    )
