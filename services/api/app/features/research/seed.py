"""트랙 프리셋 시드 — 앱 부팅 시 idempotent 하게 반영한다.

트랙과 프리셋 키워드는 사용자가 편집하지 않는 운영 데이터라, 시드 파일을 고치면
재시작만으로 반영되도록 upsert + 삭제 동기화를 한다.
사용자가 직접 추가한 `user_keywords` 는 건드리지 않는다.
"""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import TrackKeywordRow, TrackRow
from .seed_data import TRACKS, track_keyword_rows


async def seed_tracks(session: AsyncSession) -> int:
    """트랙·프리셋 키워드를 시드 파일 기준으로 맞춘다. 반영된 트랙 수를 돌려준다."""
    for order, (track_id, name, field, description, _keywords) in enumerate(TRACKS):
        stmt = pg_insert(TrackRow).values(
            id=track_id,
            name=name,
            field=field,
            description=description,
            sort_order=order,
        )
        await session.execute(
            stmt.on_conflict_do_update(
                index_elements=[TrackRow.id],
                set_={
                    "name": stmt.excluded.name,
                    "field": stmt.excluded.field,
                    "description": stmt.excluded.description,
                    "sort_order": stmt.excluded.sort_order,
                },
            )
        )

    seeded_ids = [t[0] for t in TRACKS]
    # 시드에서 빠진 트랙은 정리 (프리셋 키워드도 함께)
    stale = await session.execute(select(TrackRow.id).where(TrackRow.id.not_in(seeded_ids)))
    stale_ids = [row[0] for row in stale.all()]
    if stale_ids:
        await session.execute(
            delete(TrackKeywordRow).where(TrackKeywordRow.track_id.in_(stale_ids))
        )
        await session.execute(delete(TrackRow).where(TrackRow.id.in_(stale_ids)))

    # 프리셋 키워드는 통째로 갈아끼운다 — 양이 적고 시드가 유일한 진실이다
    await session.execute(delete(TrackKeywordRow).where(TrackKeywordRow.track_id.in_(seeded_ids)))
    rows = track_keyword_rows()
    if rows:
        await session.execute(
            pg_insert(TrackKeywordRow),
            [{"track_id": t, "keyword": k, "weight": w} for t, k, w in rows],
        )

    await session.commit()
    return len(TRACKS)
