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

    # 탐구주제 피드 — 수집 주기(시간). 0 이하면 스케줄러를 띄우지 않고
    # POST /v1/research/ingest/run 수동 실행만 쓴다.
    research_ingest_interval_hours: float = 6.0

    # 대시보드 AI 어시스턴트. 키워드 추출용 anthropic_model 과 분리해 둔다.
    # 기본 Haiku 4.5 — 실측에서 카드 툴 성공률이 상위 모델과 같으면서
    # 1,000턴당 $6.65 로 Opus 5($27.88)의 1/4다. 자세한 근거는
    # app/features/assistant/service.py 상단 주석 참고.
    # 답변 깊이가 아쉬우면 claude-sonnet-5 → claude-opus-5 순으로 올리면 된다.
    assistant_model: str = "claude-haiku-4-5"

    # Daglo STT (optional — empty disables live client init)
    daglo_api_token: str = ""
    daglo_base_url: str = "https://apis.daglo.ai"
    daglo_timeout_seconds: float = 30.0

    # NewsAPI.org (선택). 비어 있으면 newsapi 타입 소스를 건너뛴다.
    # 무료 Developer 플랜은 하루 100요청 + 기사 24시간 지연이고, 공식 약관상
    # **운영 환경에서 쓸 수 없다**(개발·테스트 전용). 그래서 시드에서도 꺼둔다.
    newsapi_key: str = ""

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
