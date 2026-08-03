FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" "uvicorn[standard]>=0.32.0" \
    "pydantic>=2.9.0" "pydantic-settings>=2.6.0" \
    "sqlalchemy[asyncio]>=2.0.36" "asyncpg>=0.30.0" \
    "neo4j>=5.26.0" "redis>=5.2.0" \
    "python-jose[cryptography]>=3.3.0" "python-multipart>=0.0.12" \
    "ulid-py>=1.1.0" "pyyaml>=6.0.2" "httpx>=0.28.0" "email-validator>=2.2.0" \
    "pymupdf>=1.24.0" "grpcio>=1.66.0" "protobuf>=5.28.0" "anthropic>=0.40.0"

# EMBEDDING_ADAPTER=real 용. CPU 전용 torch 인덱스를 쓴다 — 이 호스트에 GPU 가 없어
# CUDA 빌드는 이미지만 ~2.5GB 키우고 쓰이지 않는다.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install --no-cache-dir "sentence-transformers>=3.0.0"

# 한국어 임베딩 모델을 이미지에 미리 넣어, 첫 요청에서 ~450MB 다운로드가 발생하지 않게 한다.
ENV HF_HOME=/opt/huggingface
ENV EMBEDDING_MODEL=jhgan/ko-sroberta-multitask
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('jhgan/ko-sroberta-multitask')" \
    && find /opt/huggingface -name '*.h5' -delete \
    && find /opt/huggingface -name 'tf_model*' -delete

# 탐구 피드 수집기 의존성. torch/모델 레이어 뒤에 두어 그 캐시를 깨지 않는다.
RUN pip install --no-cache-dir "feedparser>=6.0.11" "trafilatura>=1.12.0"

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
