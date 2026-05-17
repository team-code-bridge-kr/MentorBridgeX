from pydantic import BaseModel, Field

from app.schemas.graph import NodeType


class BranchRecommendationRequest(BaseModel):
    seeds: list[str] = Field(default_factory=list)
    seed_node_ids: list[str] = Field(default_factory=list)
    max_results: int = Field(default=10, ge=1, le=50)


class SuggestedKeyword(BaseModel):
    label: str
    type: NodeType = NodeType.KEYWORD
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str | None = None


class BranchRecommendationResponse(BaseModel):
    suggestions: list[SuggestedKeyword]
    retrieval_count: int = 0


class AcceptRecommendationRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
