from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class NodeType(str, Enum):
    KEYWORD = "Keyword"
    INQUIRY = "Inquiry"
    SUBJECT = "Subject"
    ACTIVITY = "Activity"
    PERIOD = "Period"
    DOCUMENT = "Document"


class RelationType(str, Enum):
    RELATES_TO = "RELATES_TO"
    BELONGS_TO = "BELONGS_TO"
    MENTIONED_IN = "MENTIONED_IN"
    DERIVED_FROM = "DERIVED_FROM"
    OCCURRED_IN = "OCCURRED_IN"
    INFLUENCES = "INFLUENCES"
    EVOLVED_FROM = "EVOLVED_FROM"
    CONTRADICTS = "CONTRADICTS"
    EVIDENCED_BY = "EVIDENCED_BY"


class GraphNode(BaseModel):
    id: str
    type: NodeType
    label: str
    description: str | None = None
    external_refs: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class GraphEdge(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation: RelationType
    created_at: datetime


class GraphSnapshot(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class SeedRequest(BaseModel):
    seeds: list[str] = Field(..., min_length=1, max_length=20)


class NodeCreateRequest(BaseModel):
    type: NodeType = NodeType.KEYWORD
    label: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    external_refs: dict = Field(default_factory=dict)


class NodePatchRequest(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)


class EdgeCreateRequest(BaseModel):
    source_id: str
    target_id: str
    relation: RelationType
