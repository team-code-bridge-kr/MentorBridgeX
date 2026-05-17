import pytest

from app.adapters.embedding_mock import DIM, MockEmbeddingAdapter


@pytest.mark.asyncio
async def test_embedding_dimension_and_determinism() -> None:
    adapter = MockEmbeddingAdapter()
    vectors = await adapter.embed_texts(["양자컴퓨팅", "양자컴퓨팅", "환경공학"])
    assert len(vectors) == 3
    assert len(vectors[0]) == DIM
    assert vectors[0] == vectors[1]
    assert vectors[0] != vectors[2]
