from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, ensure_dev_user, get_db_session
from app.schemas.auth import DevLoginRequest, TokenResponse

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/dev-login", response_model=TokenResponse, summary="개발용 로그인 (데모)")
async def dev_login(
    body: DevLoginRequest,
    session: AsyncSession | None = Depends(get_db_session),
) -> TokenResponse:
    user = await ensure_dev_user(session, body.email, body.display_name)
    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user_id=user.id, email=user.email)
