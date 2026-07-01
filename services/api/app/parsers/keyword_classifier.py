"""Rule-based NodeType classifier for Korean 생기부 keywords."""

from __future__ import annotations

import re

from app.schemas.graph import NodeType

# 과목명은 라벨 전체가 과목명 그 자체일 때만 매칭 (부분 포함 오탐 방지)
# 예) "역사" → Subject, "역사적" → Keyword, "한국사" → Subject, "맞춤법" → Keyword
_SUBJECT_EXACT = frozenset({
    "국어", "수학", "영어", "한국사", "통합사회", "통합과학",
    "물리학", "물리", "화학", "생명과학", "지구과학",
    "미술", "음악", "체육", "기술", "정보", "사회", "윤리", "철학",
    "한문", "중국어", "일본어", "독일어", "경제", "법", "정치", "지리", "역사",
    "과학탐구실험", "사회문제탐구", "수학과제탐구",
    "과학", "기술가정",
})

_PERIOD_RE = re.compile(r"^\d\s*학년$|^\d\s*학기$|^고\s*\d|^중\s*\d|^초\s*\d|^[1-3]학년$")
_INQUIRY_RE = re.compile(
    r"탐구|연구|조사|실험|분석|발견|검증|측정|관찰|가설|논문|통계|메커니즘|"
    r"원리|이론|고찰|해석|규명|추론|검토|비교|계획|설계"
)
_ACTIVITY_RE = re.compile(
    r"동아리|봉사|대회|프로젝트|캠프|발표|토론|제작|개발|수행|팀장|리더|"
    r"멘토|멘티|협업|협력|활동|행사|공모전|창업|학술|독서|독후감|포럼|세미나"
)


def classify_node_type(label: str) -> NodeType:
    """Classify a keyword label into the most appropriate NodeType."""
    if label in _SUBJECT_EXACT:
        return NodeType.SUBJECT
    if _PERIOD_RE.search(label):
        return NodeType.PERIOD
    if _INQUIRY_RE.search(label):
        return NodeType.INQUIRY
    if _ACTIVITY_RE.search(label):
        return NodeType.ACTIVITY
    return NodeType.KEYWORD
