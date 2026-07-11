import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import create_access_token, ensure_dev_user, get_db_session
from app.errors import AppError
from app.schemas.auth import (
    DevLoginRequest,
    GoogleAuthConfig,
    GoogleCallbackRequest,
    TokenResponse,
)

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
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
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
    user = await ensure_dev_user(session, email, display_name)
    jwt_token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=jwt_token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
