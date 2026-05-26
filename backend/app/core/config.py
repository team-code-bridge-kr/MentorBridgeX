from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    daglo_api_token: str = Field(..., min_length=1)
    daglo_base_url: str = "https://apis.daglo.ai"
    daglo_timeout_seconds: float = 30.0

    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=[
            Path(__file__).resolve().parents[3] / ".env",
            Path(__file__).resolve().parents[2] / ".env",
        ],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
