"""Phase 2: async LLM-based relationship inference and graph enrichment."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.factory import get_graph_analyze_adapter
from app.db.factory import get_graph_store, is_offline_demo
from app.db.memory import get_memory_db
from app.db.postgres import JobRow
from app.schemas.graph import RelationType

logger = logging.getLogger(__name__)


class GraphAnalyzeService:
    async def run_phase2(
        self,
        *,
        session: AsyncSession | None,
        user_id: str,
        job_id: str,
        section_data: list[dict],
    ) -> None:
        """
        section_data: list of {section_text: str, node_ids: list[str]}
        Infers specific relationship types using LLM and adds edges to the graph.
        """
        adapter = get_graph_analyze_adapter()
        if adapter is None:
            # No LLM configured — mark complete as-is
            await self._finalize_job(session, job_id, 0, skipped=True)
            return

        try:
            graph_store = get_graph_store()
            snapshot = await graph_store.get_snapshot(user_id)
            node_by_id = {n.id: n for n in snapshot.nodes}

            total_new_edges = 0

            for i, sec in enumerate(section_data):
                section_text: str = sec.get("section_text", "")
                node_ids: list[str] = sec.get("node_ids", [])

                nodes = [
                    (nid, node_by_id[nid].label, node_by_id[nid].type)
                    for nid in node_ids
                    if nid in node_by_id
                ]
                if not nodes or not section_text.strip():
                    continue

                edge_specs = await adapter.infer_relationships(
                    section_text=section_text,
                    nodes=nodes,
                    max_edges=20,
                )

                label_to_id = {label: nid for nid, label, _ in nodes}
                created_pairs: set[tuple[str, str]] = set()

                for spec in edge_specs:
                    src_label = spec.get("source_label", "")
                    tgt_label = spec.get("target_label", "")
                    relation_str = spec.get("relation", "RELATES_TO")

                    src_id = label_to_id.get(src_label)
                    tgt_id = label_to_id.get(tgt_label)
                    if not src_id or not tgt_id or src_id == tgt_id:
                        continue

                    pair = (src_id, tgt_id)
                    if pair in created_pairs:
                        continue
                    created_pairs.add(pair)

                    try:
                        relation = RelationType(relation_str)
                    except ValueError:
                        relation = RelationType.RELATES_TO

                    # Skip plain RELATES_TO — already created in Phase 1
                    if relation == RelationType.RELATES_TO:
                        continue

                    try:
                        await graph_store.create_edge(
                            user_id, source_id=src_id, target_id=tgt_id, relation=relation
                        )
                        total_new_edges += 1
                    except Exception as exc:
                        logger.debug("Edge creation skipped: %s", exc)

                progress = 60 + int(35 * (i + 1) / max(len(section_data), 1))
                await self._set_progress(session, job_id, progress)

            await self._finalize_job(session, job_id, total_new_edges)

        except Exception as exc:
            logger.exception("Phase 2 graph analysis failed: %s", exc)
            await self._fail_job(session, job_id, str(exc))

    # ── helpers ───────────────────────────────────────────────────────────────

    async def _set_progress(
        self, session: AsyncSession | None, job_id: str, progress: int
    ) -> None:
        now = datetime.now(UTC)
        if is_offline_demo():
            job = get_memory_db().jobs.get(job_id)
            if job:
                job.progress = progress
                job.updated_at = now
            return
        result = await session.execute(select(JobRow).where(JobRow.id == job_id))
        row = result.scalar_one_or_none()
        if row:
            row.progress = progress
            row.updated_at = now
            await session.commit()

    async def _finalize_job(
        self,
        session: AsyncSession | None,
        job_id: str,
        new_edges: int,
        *,
        skipped: bool = False,
    ) -> None:
        now = datetime.now(UTC)
        if is_offline_demo():
            job = get_memory_db().jobs.get(job_id)
            if job:
                existing = json.loads(job.result) if job.result else {}
                existing["phase2_edges_added"] = new_edges
                existing["phase2_status"] = "skipped" if skipped else "completed"
                job.result = json.dumps(existing, ensure_ascii=False)
                job.progress = 100
                job.status = "completed"
                job.updated_at = now
            return
        result = await session.execute(select(JobRow).where(JobRow.id == job_id))
        row = result.scalar_one_or_none()
        if row:
            existing = json.loads(row.result) if row.result else {}
            existing["phase2_edges_added"] = new_edges
            existing["phase2_status"] = "skipped" if skipped else "completed"
            row.result = json.dumps(existing, ensure_ascii=False)
            row.progress = 100
            row.status = "completed"
            row.updated_at = now
            await session.commit()

    async def _fail_job(self, session: AsyncSession | None, job_id: str, error: str) -> None:
        now = datetime.now(UTC)
        if is_offline_demo():
            job = get_memory_db().jobs.get(job_id)
            if job:
                job.status = "failed"
                job.error = f"phase2: {error[:500]}"
                job.updated_at = now
            return
        result = await session.execute(select(JobRow).where(JobRow.id == job_id))
        row = result.scalar_one_or_none()
        if row:
            row.status = "failed"
            row.error = f"phase2: {error[:500]}"
            row.updated_at = now
            await session.commit()
