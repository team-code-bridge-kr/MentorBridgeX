from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, Header
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.factory import is_offline_demo
from app.db.memory import MemoryUser, get_memory_db
from app.db.postgres import UserRow, get_session, get_user_by_email, utcnow
from app.errors import AppError

ALGORITHM = "HS256"


def create_access_token(user_id: str, email: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=12)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, settings.api_secret_key, algorithm=ALGORITHM)


async def get_db_session() -> AsyncGenerator[AsyncSession | None, None]:
    if is_offline_demo():
        yield None
        return
    async for session in get_session():
        yield session


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession | None = Depends(get_db_session),
) -> UserRow | MemoryUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError("AUTH_MISSING_TOKEN", "인증 토큰이 필요합니다.", status_code=401)
    token = authorization.removeprefix("Bearer ").strip()
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.api_secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise AppError("AUTH_INVALID_TOKEN", "유효하지 않은 토큰입니다.", status_code=401)
    except JWTError as exc:
        raise AppError("AUTH_INVALID_TOKEN", "유효하지 않은 토큰입니다.", status_code=401) from exc

    if is_offline_demo():
        user = get_memory_db().users_by_id.get(user_id)
        if not user:
            raise AppError("AUTH_USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", status_code=401)
        return user

    from sqlalchemy import select

    result = await session.execute(select(UserRow).where(UserRow.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise AppError("AUTH_USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", status_code=401)
    return user


async def ensure_dev_user(
    session: AsyncSession | None, email: str, display_name: str
) -> UserRow | MemoryUser:
    if is_offline_demo():
        db = get_memory_db()
        if email in db.users_by_email:
            return db.users_by_email[email]
        now = await utcnow()
        user = MemoryUser(id=str(uuid4()), email=email, display_name=display_name, created_at=now)
        db.users_by_email[email] = user
        db.users_by_id[user.id] = user
        return user

    user = await get_user_by_email(session, email)
    if user:
        return user
    now = await utcnow()
    user = UserRow(id=str(uuid4()), email=email, display_name=display_name, created_at=now)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
