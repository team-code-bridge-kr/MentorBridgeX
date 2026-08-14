import httpx
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.factory import is_offline_demo
from app.db.postgres import UserRow, get_user_by_email, utcnow
from app.dependencies import create_access_token, ensure_dev_user, get_db_session
from app.errors import AppError
from app.features.onboarding.service import login_state
from app.schemas.auth import (
    DevLoginRequest,
    GoogleAuthConfig,
    GoogleCallbackRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.passwords import check_strength, hash_password

router = APIRouter(prefix="/v1/auth", tags=["auth"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.post("/dev-login", response_model=TokenResponse, summary="개발용 로그인 (데모)")
async def dev_login(
    body: DevLoginRequest,
    session: AsyncSession | None = Depends(get_db_session),
) -> TokenResponse:
    user = await ensure_dev_user(session, body.email, body.display_name)
    token = create_access_token(user.id, user.email)
    onboarding = await login_state(session, user.id)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=onboarding.role,
        grade=onboarding.grade,
        onboarded=onboarding.onboarded,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="비밀번호로 가입",
)
async def register(
    body: RegisterRequest,
    session: AsyncSession | None = Depends(get_db_session),
) -> TokenResponse:
    """새 계정을 만들고 곧바로 들여보낸다.

    가입해 놓고 다시 로그인 화면으로 보내지 않는다 — 방금 정한 것을 한 번 더
    적으라는 뜻이 되고, 그 사이에 오타 한 번이면 자기가 만든 계정에 못 들어간다.

    **이미 있는 이메일이면 거절한다.** 이때 "이미 가입돼 있습니다" 라고 말해도
    되는가는 늘 걸리는 문제인데(그 자체가 가입 여부를 알려 준다), 가입 화면은
    사람이 자기 이메일을 적는 자리라 숨겨서 얻는 것보다 "왜 안 되는지 모르겠다"
    로 잃는 것이 크다. 로그인 실패 쪽에서는 여전히 구별하지 않는다.
    """
    if is_offline_demo():
        raise AppError(
            "AUTH_OFFLINE_DEMO",
            "데모 모드에서는 가입할 수 없습니다.",
            status_code=400,
        )

    email = body.email.strip().lower()
    weak = check_strength(body.password)
    if weak:
        raise AppError("AUTH_WEAK_PASSWORD", weak, status_code=400)

    if await get_user_by_email(session, email):
        raise AppError(
            "AUTH_EMAIL_TAKEN",
            "이미 가입된 이메일입니다. 로그인해 주세요.",
            status_code=409,
        )

    now = await utcnow()
    user = UserRow(
        id=str(uuid4()),
        email=email,
        display_name=body.display_name.strip(),
        created_at=now,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    token = create_access_token(user.id, user.email)
    onboarding = await login_state(session, user.id)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=onboarding.role,
        grade=onboarding.grade,
        onboarded=onboarding.onboarded,
    )


@router.get("/google/config", response_model=GoogleAuthConfig, summary="Google OAuth 공개 설정")
async def google_config() -> GoogleAuthConfig:
    settings = get_settings()
    enabled = bool(settings.google_client_id and settings.google_client_secret)
    return GoogleAuthConfig(
        enabled=enabled,
        client_id=settings.google_client_id if enabled else "",
        redirect_uri=settings.google_redirect_uri if enabled else "",
    )


@router.post(
    "/google/callback",
    response_model=TokenResponse,
    summary="Google OAuth authorization code 교환",
)
async def google_callback(
    body: GoogleCallbackRequest,
    session: AsyncSession | None = Depends(get_db_session),
) -> TokenResponse:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise AppError(
            "AUTH_GOOGLE_DISABLED",
            "Google OAuth가 설정되지 않았습니다.",
            status_code=503,
        )

    redirect_uri = (body.redirect_uri or settings.google_redirect_uri).strip()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": body.code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_res.status_code >= 400:
                raise AppError(
                    "AUTH_GOOGLE_TOKEN_FAILED",
                    "Google 토큰 교환에 실패했습니다.",
                    status_code=401,
                    details={"google_status": token_res.status_code},
                )
            token_payload = token_res.json()
            access_token = token_payload.get("access_token")
            if not access_token:
                raise AppError(
                    "AUTH_GOOGLE_TOKEN_FAILED",
                    "Google access_token이 없습니다.",
                    status_code=401,
                )

            info_res = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if info_res.status_code >= 400:
                raise AppError(
                    "AUTH_GOOGLE_USERINFO_FAILED",
                    "Google 사용자 정보 조회에 실패했습니다.",
                    status_code=401,
                )
            info = info_res.json()
    except AppError:
        raise
    except httpx.HTTPError as exc:
        raise AppError(
            "AUTH_GOOGLE_NETWORK",
            "Google OAuth 요청 중 네트워크 오류가 발생했습니다.",
            status_code=502,
        ) from exc

    email = (info.get("email") or "").strip().lower()
    if not email:
        raise AppError(
            "AUTH_GOOGLE_EMAIL_MISSING",
            "Google 계정에 이메일이 없습니다.",
            status_code=400,
        )
    if info.get("email_verified") is False:
        raise AppError(
            "AUTH_GOOGLE_EMAIL_UNVERIFIED",
            "인증되지 않은 Google 이메일은 사용할 수 없습니다.",
            status_code=403,
        )

    display_name = (info.get("name") or email.split("@")[0])[:50]
    picture = info.get("picture") or None
    user = await ensure_dev_user(session, email, display_name)
    if user.display_name != display_name:
        user.display_name = display_name
        if not is_offline_demo() and session is not None:
            await session.commit()
            await session.refresh(user)

    jwt_token = create_access_token(user.id, user.email)
    onboarding = await login_state(session, user.id)
    return TokenResponse(
        access_token=jwt_token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        picture=picture,
        role=onboarding.role,
        grade=onboarding.grade,
        onboarded=onboarding.onboarded,
    )
