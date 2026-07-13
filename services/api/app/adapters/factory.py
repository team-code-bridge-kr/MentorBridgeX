from app.adapters.embedding_mock import MockEmbeddingAdapter
from app.adapters.ml_mock import MockMLAdapter
from app.adapters.protocols import EmbeddingAdapter, MLAdapter
from app.config import get_settings


def get_ml_adapter() -> MLAdapter:
    settings = get_settings()
    if settings.ml_adapter == "mock":
        return MockMLAdapter()
    if settings.ml_adapter == "real":
        from app.adapters.ml_real import AnthropicMLAdapter  # noqa: PLC0415
        return AnthropicMLAdapter(
            api_key=settings.anthropic_api_key,
            model=settings.anthropic_model,
        )
    raise ValueError(f"Unsupported ML adapter: {settings.ml_adapter}")


def get_embedding_adapter() -> EmbeddingAdapter:
    settings = get_settings()
    if settings.embedding_adapter == "mock":
        return MockEmbeddingAdapter()
    raise ValueError(f"Unsupported embedding adapter: {settings.embedding_adapter}")


def get_graph_analyze_adapter() -> MLAdapter | None:
    """Returns Anthropic adapter for graph analysis, or None if not configured."""
    settings = get_settings()
    if settings.ml_adapter == "real" and settings.anthropic_api_key:
        from app.adapters.ml_real import AnthropicMLAdapter  # noqa: PLC0415
        return AnthropicMLAdapter(
            api_key=settings.anthropic_api_key,
            model=settings.anthropic_model,
        )
    return None
