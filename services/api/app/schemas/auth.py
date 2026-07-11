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
