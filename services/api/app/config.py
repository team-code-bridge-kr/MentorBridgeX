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
    # Local sentence-transformers model used when embedding_adapter="real" (768-dim, Korean).
    embedding_model: str = "jhgan/ko-sroberta-multitask"
    offline_demo: bool = False

    # Daglo STT (optional — empty disables live client init)
    daglo_api_token: str = ""
    daglo_base_url: str = "https://apis.daglo.ai"
    daglo_timeout_seconds: float = 30.0

    # Anthropic LLM (empty disables LLM features; falls back to rule-based)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # 가지치기 추천 캐시 TTL (초). 같은 그래프 상태 + 같은 노드면 Claude 를 다시 부르지 않는다.
    pruning_cache_ttl_seconds: int = 86_400
    # 웹 자료 조사 결과 캐시 TTL (초).
    research_cache_ttl_seconds: int = 86_400

    # Google OAuth (empty disables live Google login)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://mbx.teamcodebridge.dev/oauth/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()
