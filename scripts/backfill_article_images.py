"""이미 수집된 글에 대표 이미지 주소를 채워 넣는다 (1회성 보정).

image_url 컬럼이 생기기 전에 들어온 글은 이미지가 비어 있다. 수집 때와 똑같이
robots.txt 를 확인하고 도메인당 3초 간격을 지키며 원문 페이지의 og:image 만
읽는다. 이미지를 내려받지 않고 주소만 저장한다.

컨테이너 안에서 실행한다:
    docker compose exec -T api python - < scripts/backfill_article_images.py

환경변수:
    BACKFILL_LIMIT   손볼 글 수 (기본 60) — 최근 글부터
    BACKFILL_KIND    news | paper (기본 news; 논문은 og:image 가 거의 없다)
"""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import select

from app.db.postgres import SessionLocal
from app.features.research.ingest.extract import extract_page
from app.features.research.ingest.http import PoliteClient
from app.features.research.models import ArticleRow

LIMIT = int(os.getenv("BACKFILL_LIMIT", "60"))
KIND = os.getenv("BACKFILL_KIND", "news")


async def main() -> None:
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(ArticleRow)
                .where(ArticleRow.image_url.is_(None), ArticleRow.kind == KIND)
                .order_by(ArticleRow.published_at.desc())
                .limit(LIMIT)
            )
        ).scalars().all()

        print(f"대상 {len(rows)}건 (kind={KIND})", flush=True)
        if not rows:
            return

        filled = 0
        client = PoliteClient()
        try:
            # 같은 도메인끼리는 PoliteClient 가 알아서 3초씩 벌린다.
            # 요약은 이미 있으므로 이미지만 본다.
            results = await asyncio.gather(
                *(extract_page(client, row.url, want_summary=False) for row in rows),
                return_exceptions=True,
            )
        finally:
            await client.aclose()

        for row, info in zip(rows, results, strict=True):
            if isinstance(info, Exception) or not getattr(info, "image_url", None):
                continue
            row.image_url = info.image_url
            filled += 1

        await session.commit()
        print(f"채움 {filled}건 / 실패·없음 {len(rows) - filled}건", flush=True)


asyncio.run(main())
