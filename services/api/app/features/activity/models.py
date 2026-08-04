"""최근 활동 — 사용자가 손댄 것만 저장한다.

활동 자체는 **저장하지 않는다.** 대화·기사·그래프·코멘트·문서·양식·음성은
이미 각자의 테이블에 있고, 활동 목록은 그것을 읽어서 그때그때 묶은 결과다
(`service.py`). 이벤트를 또 한 벌 적어 두면 두 기록이 어긋나는 날이 온다.

여기 남기는 것은 **사용자가 목록에 직접 한 일**뿐이다 — 이름을 바꿨거나,
위로 고정했거나, 목록에서 숨겼거나. 이건 어디에도 저장할 곳이 없다.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base

# 고정은 "밀리지 않게 붙잡아 두는 것"이지 두 번째 목록이 아니다.
# 너무 많아지면 최근 활동이 고정 목록에 밀려 안 보인다.
MAX_PINNED = 5


class ActivityMetaRow(Base):
    """활동 하나에 대한 사용자 표시. 활동 키는 service.py 가 만든다.

    키가 (대화 id / 기사 id / 날짜 버킷 …) 처럼 원본을 가리키므로, 원본이
    사라지면 이 행은 그냥 아무 활동에도 붙지 않는 채로 남는다 — 해롭지 않다.
    """

    __tablename__ = "activity_meta"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    activity_key: Mapped[str] = mapped_column(String(120), primary_key=True)
    # 사용자가 직접 붙인 이름. 비어 있으면 서버가 만든 제목을 쓴다.
    title: Mapped[str] = mapped_column(String(160), default="")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    # 목록에서만 숨긴다 — 원본(대화·그래프·문서)은 건드리지 않는다
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
