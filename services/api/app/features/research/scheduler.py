"""수집 스케줄러.

node-cron 대신 asyncio 루프를 쓴다. 주기가 "N시간마다" 하나뿐이라 cron 표현식이
필요 없고, 새 의존성 없이 lifespan 에 붙일 수 있다.

수집 사이클이 끝나면 개념(article_terms)을 다시 계산한다. TF-IDF 는 코퍼스
전체를 알아야 해서 수집 중에 건건이 계산할 수 없기 때문이다.
"""

from __future__ import annotations

import asyncio
import logging

from app.db.postgres import SessionLocal

from .ingest.runner import run_ingest
from .terms.service import recompute_terms

logger = logging.getLogger("research.scheduler")


async def _cycle() -> None:
    async with SessionLocal() as session:
        logs = await run_ingest(session)
        new_items = sum(log.items_new for log in logs)
        logger.info("ingest cycle done sources=%d new=%d", len(logs), new_items)
        if new_items:
            await recompute_terms(session)


async def scheduler_loop(interval_hours: float, *, startup_delay_sec: float = 60.0) -> None:
    """주기적으로 수집을 돌린다. 취소되면 조용히 끝난다.

    부팅 직후에는 잠시 기다린다 — 재배포로 컨테이너가 자주 재시작될 때
    외부 소스에 요청이 몰리지 않게 하기 위함이다.
    """
    interval = max(0.25, interval_hours) * 3600
    try:
        await asyncio.sleep(startup_delay_sec)
        while True:
            try:
                await _cycle()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 — 한 번 실패해도 다음 주기는 돌아야 한다
                logger.exception("ingest cycle failed")
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("scheduler stopped")
        raise
