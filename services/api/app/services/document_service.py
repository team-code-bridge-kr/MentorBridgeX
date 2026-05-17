import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.factory import get_ml_adapter
from app.db.factory import get_graph_store, is_offline_demo
from app.db.memory import MemoryDocument, MemoryJob, get_memory_db
from app.db.postgres import DocumentSectionRow, JobRow, utcnow
from app.schemas.documents import DocumentCreateRequest, DocumentPatchRequest, DocumentSection, SectionType
from app.schemas.graph import NodeType


class DocumentService:
    def __init__(self) -> None:
        self.graph = get_graph_store()
        self.ml = get_ml_adapter()

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
        self, session: AsyncSession | None, user_id: str, filename: str
    ) -> str:
        now = await utcnow()
        job_id = str(uuid4())
        if is_offline_demo():
            job = MemoryJob(
                id=job_id,
                user_id=user_id,
                job_type="pdf_import",
                status="queued",
                progress=0,
                payload=json.dumps({"filename": filename}),
                result=None,
                error=None,
                created_at=now,
                updated_at=now,
            )
            get_memory_db().jobs[job_id] = job
            await self._complete_pdf_import_mock(session, user_id, job_id)
            return job_id

        job = JobRow(
            id=job_id,
            user_id=user_id,
            job_type="pdf_import",
            status="queued",
            progress=0,
            payload=json.dumps({"filename": filename}),
            created_at=now,
            updated_at=now,
        )
        session.add(job)
        await session.commit()
        await self._complete_pdf_import_mock(session, user_id, job_id)
        return job_id

    async def _complete_pdf_import_mock(
        self, session: AsyncSession | None, user_id: str, job_id: str
    ) -> None:
        now = await utcnow()
        mock_text = (
            "화학 실험을 통해 산화·환원 반응의 특성을 탐구하였고, "
            "실험 설계와 데이터 분석 역량을 기르았습니다."
        )

        if is_offline_demo():
            section = MemoryDocument(
                id=str(uuid4()),
                user_id=user_id,
                section_type=SectionType.SUBJECT_SPECIFIC.value,
                content=mock_text,
                period_id=None,
                subject_id=None,
                version=1,
                source="pdf_parsed",
                created_at=now,
                updated_at=now,
            )
            get_memory_db().documents[section.id] = section
        else:
            section = DocumentSectionRow(
                id=str(uuid4()),
                user_id=user_id,
                section_type=SectionType.SUBJECT_SPECIFIC.value,
                content=mock_text,
                version=1,
                source="pdf_parsed",
                created_at=now,
                updated_at=now,
            )
            session.add(section)

        keywords = await self.ml.extract_keywords_from_text(user_id=user_id, text=mock_text)
        await self.graph.create_node(
            user_id,
            node_type=NodeType.DOCUMENT,
            label="PDF 파싱: 세특",
            external_refs={"document_section_id": section.id},
        )
        for label, node_type in keywords:
            await self.graph.create_node(user_id, node_type=node_type, label=label)

        if is_offline_demo():
            job = get_memory_db().jobs[job_id]
            job.status = "completed"
            job.progress = 100
            job.result = json.dumps(
                {"document_section_id": section.id, "keywords": [k[0] for k in keywords]}
            )
            job.updated_at = now
        else:
            result = await session.execute(select(JobRow).where(JobRow.id == job_id))
            job = result.scalar_one()
            job.status = "completed"
            job.progress = 100
            job.result = json.dumps(
                {"document_section_id": section.id, "keywords": [k[0] for k in keywords]}
            )
            job.updated_at = now
            await session.commit()
