import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import get_graph_store, is_offline_demo
from app.db.memory import MemoryDocument, MemoryJob, get_memory_db
from app.db.postgres import DocumentSectionRow, JobRow, utcnow
from app.errors import AppError
from app.parsers.pdf_extractor import ParsedPdf, parse_pdf_bytes
from app.schemas.documents import DocumentCreateRequest, DocumentPatchRequest, DocumentSection, SectionType
from app.schemas.graph import NodeType, RelationType


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
        self, session: AsyncSession | None, user_id: str, section_id: str, body: DocumentPatchRequest
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

    async def _complete_pdf_import(
        self,
        session: AsyncSession | None,
        user_id: str,
        job_id: str,
        parsed: ParsedPdf,
    ) -> None:
        now = await utcnow()
        section_ids: list[str] = []

        for block in parsed.sections:
            section_ids.append(
                await self._persist_section(
                    session,
                    user_id,
                    section_type=block.section_type,
                    content=block.content,
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

        keyword_labels: list[str] = []
        for label, freq in parsed.token_frequencies:
            kw_node = await self.graph.create_node(
                user_id,
                node_type=NodeType.KEYWORD,
                label=label,
                description=f"pdf_freq={freq}",
                external_refs={
                    "source": "pdf_tokens",
                    "frequency": freq,
                    # ML weight reserved for team lead / future adapter
                    "weight": None,
                },
            )
            keyword_labels.append(label)
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
            "token_count": parsed.token_count,
            "unique_token_count": parsed.unique_token_count,
            "keywords": keyword_labels,
            "extractor": "pymupdf+rule_tokens",
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
