from pydantic import BaseModel, EmailStr, Field


class DevLoginRequest(BaseModel):
    email: EmailStr = Field(default="student@example.com")
    display_name: str = Field(default="데모 학생", max_length=50)


class GoogleCallbackRequest(BaseModel):
    code: str = Field(min_length=1, max_length=2048)
    redirect_uri: str | None = Field(
        default=None,
        description="Must match the redirect_uri used at Google authorize time",
        max_length=512,
    )


class GoogleAuthConfig(BaseModel):
    enabled: bool
    client_id: str = ""
    redirect_uri: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    display_name: str | None = None
    picture: str | None = None
    # 온보딩에서 고른 역할. **아직 안 골랐으면 None** 이다 — 서버가 모르는 것을
    # "학생"이라고 단정하지 않는다(프런트에 이메일로 추측하는 데모 경로가 남아 있다).
    role: str | None = None
    # 학년 — 1학년은 '발견'을, 3학년은 논문을 먼저 보여주는 데 쓴다.
    grade: str | None = None
    # 온보딩을 끝냈는지. 로그인 직후 어디로 보낼지 정하는 데 쓴다.
    onboarded: bool = False
