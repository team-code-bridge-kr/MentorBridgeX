from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class NodeType(StrEnum):
    KEYWORD = "Keyword"
    INQUIRY = "Inquiry"
    SUBJECT = "Subject"
    ACTIVITY = "Activity"
    PERIOD = "Period"
    DOCUMENT = "Document"


class RelationType(StrEnum):
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
    """노드 고치기. **보낸 항목만** 바뀐다(None 은 "그대로 두라"는 뜻).

    과목·분야는 `external_refs.section` 에 들어 있다. 학생이 화면에서 과목을
    바꾸면 여기로 온다 — 아이콘과 그래프 배치가 그 값으로 정해지므로, 이름만
    고칠 수 있으면 잘못 분류된 노드를 바로잡을 방법이 없다.
    """

    label: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    type: NodeType | None = None
    external_refs: dict | None = None


class NodeEvidenceQuote(BaseModel):
    """노드 이름이 실제로 적혀 있던 생기부 문장 한 줄.

    `match_start`/`match_end` 는 `text` 안에서 노드 이름이 있는 자리다. 화면에서
    그 부분만 강조하기 위한 값이라, 문장을 잘라내면 잘린 뒤 기준으로 다시 센다.
    """

    section_type: str
    section_label: str
    text: str
    match_start: int
    match_end: int


class NodeEvidence(BaseModel):
    """`origin` — 이 노드가 어디서 왔는지.

    `document`(생기부에서 뽑음) · `student`(직접 만듦) · `branch`(가지치기 추천).
    문장을 못 찾았을 때 왜 없는지 말하려면 필요하다. 직접 만든 노드에 출처가
    없는 건 오류가 아니다.

    `total` 은 찾은 문장 전체 개수다. `quotes` 는 그중 앞의 몇 개만 담는다.
    """

    node_id: str
    label: str
    origin: str
    quotes: list[NodeEvidenceQuote] = Field(default_factory=list)
    total: int = 0


class EdgeCreateRequest(BaseModel):
    source_id: str
    target_id: str
    relation: RelationType
