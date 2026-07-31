import json
import logging
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import get_graph_store, is_offline_demo
from app.db.memory import MemoryDocument, MemoryJob, get_memory_db
from app.db.postgres import DocumentSectionRow, JobRow, utcnow
from app.errors import AppError
from app.parsers.pdf_extractor import ParsedPdf, parse_pdf_bytes
from app.schemas.documents import (
    DocumentCreateRequest,
    DocumentPatchRequest,
    DocumentSection,
    SectionType,
)
from app.schemas.extraction import ExtractedKeyword
from app.schemas.graph import NodeType, RelationType
from app.services.keyword_extraction import extract_keywords

logger = logging.getLogger(__name__)

# Cap on graph nodes created per PDF import. The full token list still lands in the
# job result; this only bounds what becomes a node, so one PDF can't produce thousands.
_MAX_KEYWORD_NODES = 60


def _merge_sections_by_type(sections: list) -> list[tuple[SectionType, str]]:
    """파싱된 조각들을 생기부 영역 단위로 합친다.

    화면(S11)은 "8가지 생기부 영역"을 영역당 카드 하나로 보여주고 그 카드에
    문서 한 건을 연결한다. 그런데 실제 생기부는 한 영역이 학년별·과목별로
    여러 조각이다(표본 19쪽에서 세특 46, 자율활동 5, 봉사활동 6조각).
    조각마다 행을 만들면 카드가 그중 하나만 보여줘서 나머지가 사라진 것처럼 된다.

    세특은 조각 제목이 과목명이라 앞에 붙여 둔다. 나머지 영역은 제목이 영역명
    자체라 붙여봐야 같은 말의 반복이므로 본문만 잇는다.
    """
    order: list[SectionType] = []
    buckets: dict[SectionType, list[str]] = {}

    for block in sections:
        if block.section_type not in buckets:
            buckets[block.section_type] = []
            order.append(block.section_type)
        body = block.content.strip()
        if not body:
            continue
        title = block.title.strip()
        if block.section_type is SectionType.SUBJECT_SPECIFIC and title:
            body = f"[{title}] {body}"
        buckets[block.section_type].append(body)

    return [(t, "\n\n".join(buckets[t])) for t in order if buckets[t]]


def _sections_for_extraction(sections: list) -> list[tuple[str, str]]:
    """키워드 추출에 넘길 섹션 목록을 만든다.

    두 가지를 한다.

    1. 같은 (유형, 제목) 조각을 하나로 합친다. 자율활동 5조각, 봉사활동 6조각처럼
       학년별로 쪼개진 것들이 각각 한 칸씩 차지하지 않게 한다. 표본 기준 69 -> 48.

    2. 유형을 돌아가며 뽑는다. 파싱 결과는 세특이 앞에 몰려 있는데(46/69), 어댑터가
       앞에서부터 정해진 개수만 처리하기 때문에 그대로 넘기면 창의적 체험활동이
       한 번도 안 보인다. 실제로 그래프에 자율·동아리·봉사·진로가 통째로 빠졌다.
       유형별로 번갈아 뽑으면 조각이 적은 영역도 반드시 앞쪽에 들어간다.
    """
    order: list[str] = []
    buckets: dict[str, dict[str, list[str]]] = {}

    for block in sections:
        key = block.section_type.value
        if key not in buckets:
            buckets[key] = {}
            order.append(key)
        body = block.content.strip()
        if not body:
            continue
        buckets[key].setdefault(block.title, []).append(body)

    queues = [
        [(title, "\n\n".join(bodies)) for title, bodies in buckets[key].items()]
        for key in order
    ]

    out: list[tuple[str, str]] = []
    while any(queues):
        for queue in queues:
            if queue:
                out.append(queue.pop(0))
    return out


class DocumentService:
    def __init__(self) -> None:
        self.graph = get_graph_store()

    def _to_schema_from_row(self, row: DocumentSectionRow) -> DocumentSection:
        return DocumentSection(
            id=row.id,
            section_type=SectionType(row.section_type),
            content=row.content,
            period_id=row.period_id,
            subject_id=row.subject_id,
            version=row.version,
            source=row.source,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _to_schema_from_memory(self, doc: MemoryDocument) -> DocumentSection:
        return DocumentSection(
            id=doc.id,
            section_type=SectionType(doc.section_type),
            content=doc.content,
            period_id=doc.period_id,
            subject_id=doc.subject_id,
            version=doc.version,
            source=doc.source,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )

    async def list_sections(
        self, session: AsyncSession | None, user_id: str
    ) -> list[DocumentSection]:
        if is_offline_demo():
            db = get_memory_db()
            docs = [d for d in db.documents.values() if d.user_id == user_id]
            docs.sort(key=lambda d: d.updated_at, reverse=True)
            return [self._to_schema_from_memory(d) for d in docs]

        result = await session.execute(
            select(DocumentSectionRow)
            .where(DocumentSectionRow.user_id == user_id)
            .order_by(DocumentSectionRow.updated_at.desc())
        )
        return [self._to_schema_from_row(r) for r in result.scalars().all()]

    async def create_section(
        self, session: AsyncSession | None, user_id: str, body: DocumentCreateRequest
    ) -> DocumentSection:
        now = await utcnow()
        if is_offline_demo():
            doc = MemoryDocument(
                id=str(uuid4()),
                user_id=user_id,
                section_type=body.section_type.value,
                content=body.content,
                period_id=None,
                subject_id=None,
                version=1,
                source="manual",
                created_at=now,
                updated_at=now,
            )
            get_memory_db().documents[doc.id] = doc
            return self._to_schema_from_memory(doc)

        row = DocumentSectionRow(
            id=str(uuid4()),
            user_id=user_id,
            section_type=body.section_type.value,
            content=body.content,
            version=1,
            source="manual",
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return self._to_schema_from_row(row)

    async def patch_section(
        self,
        session: AsyncSession | None,
        user_id: str,
        section_id: str,
        body: DocumentPatchRequest,
    ) -> DocumentSection | None:
        if is_offline_demo():
            doc = get_memory_db().documents.get(section_id)
            if not doc or doc.user_id != user_id:
                return None
            doc.content = body.content
            doc.version += 1
            doc.updated_at = await utcnow()
            return self._to_schema_from_memory(doc)

        result = await session.execute(
            select(DocumentSectionRow).where(
                DocumentSectionRow.user_id == user_id,
                DocumentSectionRow.id == section_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        row.content = body.content
        row.version += 1
        row.updated_at = await utcnow()
        await session.commit()
        await session.refresh(row)
        return self._to_schema_from_row(row)

    async def start_pdf_import(
        self,
        session: AsyncSession | None,
        user_id: str,
        filename: str,
        file_bytes: bytes,
    ) -> str:
        now = await utcnow()
        job_id = str(uuid4())
        payload = json.dumps({"filename": filename, "size_bytes": len(file_bytes)})

        if is_offline_demo():
            job = MemoryJob(
                id=job_id,
                user_id=user_id,
                job_type="pdf_import",
                status="queued",
                progress=0,
                payload=payload,
                result=None,
                error=None,
                created_at=now,
                updated_at=now,
            )
            get_memory_db().jobs[job_id] = job
        else:
            job = JobRow(
                id=job_id,
                user_id=user_id,
                job_type="pdf_import",
                status="queued",
                progress=0,
                payload=payload,
                created_at=now,
                updated_at=now,
            )
            session.add(job)
            await session.commit()

        try:
            parsed = parse_pdf_bytes(file_bytes)
        except Exception as exc:  # noqa: BLE001 — surface parse errors on job
            await self._fail_pdf_import(session, user_id, job_id, str(exc))
            raise AppError(
                "PDF_PARSE_FAILED",
                "PDF에서 텍스트를 추출하지 못했습니다.",
                status_code=422,
                details={"reason": str(exc)},
            ) from exc

        if not parsed.full_text.strip():
            await self._fail_pdf_import(session, user_id, job_id, "empty_text")
            raise AppError(
                "PDF_EMPTY",
                "PDF에서 추출된 텍스트가 없습니다.",
                status_code=422,
            )

        await self._complete_pdf_import(session, user_id, job_id, parsed)
        return job_id

    async def _fail_pdf_import(
        self,
        session: AsyncSession | None,
        user_id: str,
        job_id: str,
        error: str,
    ) -> None:
        now = await utcnow()
        if is_offline_demo():
            job = get_memory_db().jobs[job_id]
            job.status = "failed"
            job.error = error
            job.updated_at = now
            return

        result = await session.execute(select(JobRow).where(JobRow.id == job_id))
        job = result.scalar_one()
        job.status = "failed"
        job.error = error
        job.updated_at = now
        await session.commit()

    async def _persist_section(
        self,
        session: AsyncSession | None,
        user_id: str,
        *,
        section_type: SectionType,
        content: str,
        now,
    ) -> str:
        section_id = str(uuid4())
        if is_offline_demo():
            section = MemoryDocument(
                id=section_id,
                user_id=user_id,
                section_type=section_type.value,
                content=content,
                period_id=None,
                subject_id=None,
                version=1,
                source="pdf_parsed",
                created_at=now,
                updated_at=now,
            )
            get_memory_db().documents[section_id] = section
            return section_id

        row = DocumentSectionRow(
            id=section_id,
            user_id=user_id,
            section_type=section_type.value,
            content=content,
            version=1,
            source="pdf_parsed",
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        return section_id

    async def _extract_keywords(self, parsed: ParsedPdf) -> tuple[list[ExtractedKeyword], str]:
        """Pick keywords for graph nodes, tagging the extractor with the PDF pipeline."""
        keywords, extractor = await extract_keywords(
            sections=_sections_for_extraction(parsed.sections),
            token_freqs=parsed.token_frequencies,
            limit=_MAX_KEYWORD_NODES,
            rule_source="pdf_tokens",
        )
        return keywords, f"pymupdf+{extractor}"

    async def _complete_pdf_import(
        self,
        session: AsyncSession | None,
        user_id: str,
        job_id: str,
        parsed: ParsedPdf,
    ) -> None:
        now = await utcnow()
        section_ids: list[str] = []

        for section_type, content in _merge_sections_by_type(parsed.sections):
            section_ids.append(
                await self._persist_section(
                    session,
                    user_id,
                    section_type=section_type,
                    content=content,
                    now=now,
                )
            )

        doc_node = await self.graph.create_node(
            user_id,
            node_type=NodeType.DOCUMENT,
            label=f"PDF import ({parsed.page_count}p)",
            description=f"sections={len(parsed.sections)}",
            external_refs={"document_section_ids": section_ids},
        )

        # Full token stats stay in the job result whichever extractor ran; only the
        # number of graph *nodes* is bounded.
        tokens_payload: list[dict[str, int | str]] = [
            {"label": label, "frequency": freq} for label, freq in parsed.token_frequencies
        ]

        keywords, extractor = await self._extract_keywords(parsed)

        keyword_labels: list[str] = []
        for keyword in keywords:
            description = keyword.rationale
            if not description and keyword.frequency is not None:
                description = f"pdf_freq={keyword.frequency}"
            kw_node = await self.graph.create_node(
                user_id,
                node_type=keyword.node_type,
                label=keyword.label,
                description=description,
                external_refs={
                    "source": keyword.source,
                    "frequency": keyword.frequency,
                    "weight": keyword.confidence,
                    "section": keyword.section_title,
                },
            )
            keyword_labels.append(keyword.label)
            await self.graph.create_edge(
                user_id,
                source_id=kw_node.id,
                target_id=doc_node.id,
                relation=RelationType.MENTIONED_IN,
            )

        result_payload = {
            "document_section_ids": section_ids,
            "page_count": parsed.page_count,
            "sections_parsed": len(parsed.sections),
            "section_titles": [s.title for s in parsed.sections],
            "token_count": parsed.token_count,
            "unique_token_count": parsed.unique_token_count,
            "tokens": tokens_payload,
            "keywords": keyword_labels,
            "keyword_node_count": len(keyword_labels),
            "extractor": extractor,
        }

        if is_offline_demo():
            job = get_memory_db().jobs[job_id]
            job.status = "completed"
            job.progress = 100
            job.result = json.dumps(result_payload, ensure_ascii=False)
            job.updated_at = now
            return

        result = await session.execute(select(JobRow).where(JobRow.id == job_id))
        job = result.scalar_one()
        job.status = "completed"
        job.progress = 100
        job.result = json.dumps(result_payload, ensure_ascii=False)
        job.updated_at = now
        await session.commit()
