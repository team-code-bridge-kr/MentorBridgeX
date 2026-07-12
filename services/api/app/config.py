from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_debug: bool = True
    api_secret_key: str = "dev-secret-change-in-production"

    database_url: str = "postgresql+asyncpg://mentor:mentor@localhost:5432/mentorbridgex"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "mentorbridgex"
    redis_url: str = "redis://localhost:6379/0"

    ml_adapter: str = "mock"
    embedding_adapter: str = "mock"
    offline_demo: bool = False

    # Daglo STT (optional — empty disables live client init)
    daglo_api_token: str = ""
    daglo_base_url: str = "https://apis.daglo.ai"
    daglo_timeout_seconds: float = 30.0

    # Anthropic LLM (empty disables LLM features; falls back to rule-based)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Google OAuth (empty disables live Google login)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://mbx.teamcodebridge.dev/oauth/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()
