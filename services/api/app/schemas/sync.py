from pydantic import BaseModel, Field

from app.schemas.graph import GraphNode


class TextToGraphRequest(BaseModel):
    section_title: str = Field(..., description="섹션 이름 (예: 국어, 수학)")
    text: str = Field(..., min_length=10, description="수정된 섹션 텍스트")


class TextToGraphResult(BaseModel):
    added_nodes: list[GraphNode]
    added_count: int


class GraphToTextRequest(BaseModel):
    node_id: str = Field(..., description="삽입할 노드 ID")
    section_title: str = Field(..., description="삽입 대상 섹션 이름")
    section_text: str = Field(..., description="현재 섹션 텍스트 (컨텍스트용)")


class GraphToTextResult(BaseModel):
    node_id: str
    node_label: str
    suggested_sentence: str
    insert_hint: str  # 삽입 위치 힌트 (예: "마지막 문장 다음")
