"""이미 만들어진 보고서의 `used_nodes` 를 진짜 근거 구획으로 되돌린다.

고치기 전에 만들어진 문서에는 그래프 노드 앞 열두 개가 들어 있다 — 보고서와
아무 상관 없는 목록이다. 새 문서만 고쳐지고 옛 문서는 계속 거짓말을 한다.

**다시 계산해도 되는가**를 먼저 따진다. 근거 고르기는 (생기부 구획, 양식)
만으로 정해지는 계산이라, 문서를 만든 뒤 생기부가 바뀌지 않았다면 지금
계산한 값이 **그때 쓴 것과 같다**. 바뀌었다면 알 수 없으므로 건드리지 않는다 —
모르는 것을 그럴듯하게 채우면 고치기 전과 똑같은 잘못이다.

    docker compose exec -T api python /app/ops/backfill_form_sources.py [--apply]

`--apply` 없이 돌리면 무엇이 어떻게 바뀔지만 보여준다.
"""

from __future__ import annotations

import asyncio
import json
import sys

from sqlalchemy import select

from app.db.postgres import DocumentSectionRow, FormDocRow, SessionLocal
from app.services import form_writer
from app.services.document_service import DocumentService

APPLY = "--apply" in sys.argv


async def main() -> None:
    async with SessionLocal() as session:
        docs = (await session.execute(select(FormDocRow))).scalars().all()
        # 사용자마다 생기부를 한 번만 읽는다
        sections_by_user: dict[str, list] = {}
        latest_by_user: dict[str, object] = {}

        changed = skipped = same = 0
        for doc in docs:
            uid = doc.user_id
            if uid not in sections_by_user:
                sections_by_user[uid] = await DocumentService().list_sections(session, uid)
                latest = await session.execute(
                    select(DocumentSectionRow.updated_at)
                    .where(DocumentSectionRow.user_id == uid)
                    .order_by(DocumentSectionRow.updated_at.desc())
                    .limit(1)
                )
                latest_by_user[uid] = latest.scalar_one_or_none()

            newest = latest_by_user[uid]
            if newest is not None and newest > doc.created_at:
                # 문서를 만든 뒤 생기부가 바뀌었다. 지금 계산한 값은 그때 쓴 것이
                # 아니므로 그대로 둔다.
                print(f"[건너뜀] {doc.id} {doc.template_id} — 만든 뒤 생기부가 바뀜")
                skipped += 1
                continue

            blocks = form_writer.evidence_blocks(
                sections_by_user[uid], form_writer.SECTION_FOR_TEMPLATE.get(doc.template_id)
            )
            sources = form_writer.evidence_sources(blocks)
            new_val = json.dumps(sources, ensure_ascii=False)
            if new_val == (doc.used_nodes or "[]"):
                same += 1
                continue

            old = json.loads(doc.used_nodes or "[]")
            print(f"[바꿈]   {doc.id} {doc.template_id}")
            print(f"           전: {old[:6]}")
            print(f"           후: {sources[:6]} ({len(sources)}구획)")
            if APPLY:
                doc.used_nodes = new_val
            changed += 1

        if APPLY:
            await session.commit()
        print(
            f"\n{'적용' if APPLY else '미리보기'}: 바꿈 {changed} · 그대로 {same} · 건너뜀 {skipped}"
        )


asyncio.run(main())
