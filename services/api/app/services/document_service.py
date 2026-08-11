import json
import logging
import re
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import get_graph_store, is_offline_demo
from app.db.memory import MemoryDocument, MemoryJob, get_memory_db
from app.db.postgres import DocumentFileRow, DocumentSectionRow, JobRow, utcnow
from app.errors import AppError
from app.parsers.pdf_extractor import ParsedPdf, parse_pdf_bytes
from app.parsers.subject_blocks import split_subject_blocks
from app.schemas.documents import (
    DocumentCreateRequest,
    DocumentPatchRequest,
    DocumentSection,
    SectionType,
)
from app.schemas.extraction import ExtractedKeyword
from app.schemas.graph import NodeType, RelationType
from app.services.graph_structure import rebuild as rebuild_structure
from app.services.keyword_extraction import extract_keywords

logger = logging.getLogger(__name__)

# 한 번 가져올 때 만드는 개념 노드 수.
#
# 예전에는 60 으로 못 박아 뒀다. 어댑터가 구획을 돌아가며 뽑으니 공평하기는 한데,
# 구획이 48개면 하나에 1.2개씩 돌아가서 뒤쪽 구획은 대표 노드가 아예 없었다.
# 구획 수에 맞춰 늘린다 — 구획마다 셋씩, 다만 그래프가 읽히는 선(200)에서 멈춘다.
_NODES_PER_SECTION = 3
_MAX_KEYWORD_NODES = 200


def _node_budget(section_count: int) -> int:
    return max(_NODES_PER_SECTION, min(_MAX_KEYWORD_NODES, section_count * _NODES_PER_SECTION))


def _normalize(text: str) -> str:
    """글자만 견주기 위한 꼴. 줄바꿈·공백 차이로 같은 글이 달라 보이지 않게 한다."""
    return re.sub(r"\s+", " ", text or "").strip()


# 앞부분이 이만큼 같으면 "같은 글"로 본다.
#
# 예전에 저장된 글과 지금 다시 읽은 글은 **전처리가 달라져서** 글자 단위로는
# 어긋난다 — 쪽 꼬리말("/ 이름")이 빠졌고, 줄 끝에서 끊겼던 낱말("도 움을")이
# 붙었다. 그래도 첫 40자는 그대로다. 공백을 다 지우고 앞부분만 견주면 그 두
# 차이를 넘어 같은 글임을 알아볼 수 있다.
SAME_PREFIX = 40


def _packed(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def _probes(text: str) -> list[str]:
    """같은 글인지 견주기 위한 표본 몇 개(앞·가운데·뒤).

    앞부분만 보면 안 되는 경우가 있다 — 예전 저장본은 쪽 꼬리말이 글 중간에
    끼어 있어서 시작이 어긋나기도 한다. 세 군데 중 하나만 맞아도 같은 글이다.
    """
    packed = _packed(text)
    if len(packed) < SAME_PREFIX:
        return []
    spots = {0, max(0, len(packed) // 2 - SAME_PREFIX // 2), len(packed) - SAME_PREFIX}
    return [packed[i : i + SAME_PREFIX] for i in sorted(spots)]


def _document_label(owner_name: str) -> str:
    """그래프 한가운데 놓이는 문서 노드의 이름.

    예전에는 "PDF import (19p)" 였다. 화면 정중앙에 가장 크게 놓이는 노드인데
    파일 처리 흔적이 그대로 보여서, 학생 이름을 붙인 사람이 읽는 이름으로 바꾼다.
    이름을 모르면 사람 이름 자리를 비워 두지 않고 "내 생기부" 로 둔다.
    """
    name = " ".join((owner_name or "").split())
    return f"{name}의 생기부" if name else "내 생기부"


def _merge_sections_by_type(sections: list) -> list[tuple[SectionType, str | None, str | None, str]]:
    """파싱된 조각들을 저장 단위로 합친다. `(영역, 과목, 학년, 본문)` 을 돌려준다.

    화면(S11)은 "8가지 생기부 영역"을 영역당 카드 하나로 보여준다. 그런데 실제
    생기부는 한 영역이 학년별로 여러 조각이다(표본 19쪽에서 자율활동 5, 봉사활동
    6조각). 조각마다 행을 만들면 카드가 그중 하나만 보여줘서 나머지가 사라진
    것처럼 된다. 그래서 영역 하나에 행 하나로 합친다.

    **세특만 예외로 학년·과목마다 행을 만든다.** 표본에서 세특은 46과목
    21,000자였다. 한 덩어리로 두면 편집 상자 하나에 21,000자가 들어가고, 노드가
    어느 과목에서 나왔는지도 말할 수 없다.

    묶는 단위는 과목이 아니라 **(학년, 과목)** 이다. 미술은 1·3학년에 모두 있는데
    과목만으로 묶으면 2년 치 기록이 한 칸에 뭉쳐 어느 해 이야기인지 알 수 없다.
    같은 학년 안에서 같은 과목이 학기별로 나뉜 것만 하나로 합친다.
    """
    order: list[tuple[SectionType, str | None, str | None]] = []
    buckets: dict[tuple[SectionType, str | None, str | None], list[str]] = {}

    for block in sections:
        body = block.content.strip()
        if not body:
            continue
        title = " ".join(block.title.split())
        is_subject = block.section_type is SectionType.SUBJECT_SPECIFIC
        subject = title if is_subject and title else None
        grade = getattr(block, "grade", None) if is_subject else None
        key = (block.section_type, subject, grade)
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(body)

    return [(t, s, g, "\n\n".join(buckets[(t, s, g)])) for t, s, g in order if buckets[(t, s, g)]]


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
                period_id=body.period_id or None,
                subject_id=body.subject_id or None,
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
            subject_id=body.subject_id or None,
            period_id=body.period_id or None,
            version=1,
            source="manual",
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return self._to_schema_from_row(row)

    async def _pdf_blocks(self, session: AsyncSession, user_id: str) -> list[tuple]:
        """보관된 원본 PDF 를 다시 읽어 `(영역, 과목, 학년, 본문)` 전부를 돌려준다."""
        row = (
            await session.execute(
                select(DocumentFileRow).where(DocumentFileRow.user_id == user_id)
            )
        ).scalar_one_or_none()
        if row is None:
            return []
        try:
            parsed = parse_pdf_bytes(row.content)
        except Exception as exc:  # noqa: BLE001
            logger.warning("정리용 PDF 재파싱 실패 user=%s: %s", user_id, exc)
            return []
        return _merge_sections_by_type(parsed.sections)

    async def _refresh_other_sections(
        self, session: AsyncSession, user_id: str, blocks: list[tuple], now
    ) -> int:
        """세특이 아닌 영역을 새 전처리로 다시 읽어 넣는다.

        **행은 그대로 두고 글자만 바꾼다.** id 가 바뀌면 열어 둔 화면이 없는
        문서를 가리키게 된다. 원본에서 온 것이 확실한 행만 손댄다 — 손으로 쓴
        글은 건드리지 않는다.
        """
        wanted = {
            t.value: body
            for t, subject, _grade, body in blocks
            if t is not SectionType.SUBJECT_SPECIFIC and not subject
        }
        if not wanted:
            return 0
        rows = (
            (
                await session.execute(
                    select(DocumentSectionRow).where(
                        DocumentSectionRow.user_id == user_id,
                        DocumentSectionRow.section_type != SectionType.SUBJECT_SPECIFIC.value,
                    )
                )
            )
            .scalars()
            .all()
        )
        changed = 0
        for row in rows:
            target = wanted.get(row.section_type)
            if not target or row.content == target:
                continue
            # 같은 글인지 — 전처리가 달라져 글자는 어긋나므로 표본으로 견준다.
            packed_target = _packed(target)
            packed_row = _packed(row.content)
            same = any(p in packed_target for p in _probes(row.content)) or any(
                p in packed_row for p in _probes(target)
            )
            if not same:
                continue
            row.content = target
            row.version += 1
            row.updated_at = now
            changed += 1
        return changed

    async def _pdf_subject_blocks(
        self, session: AsyncSession, user_id: str
    ) -> list[tuple[str | None, str | None, str]]:
        """보관된 원본 PDF 에서 세특을 다시 읽어 `(과목, 학년, 본문)` 으로 돌려준다.

        학년은 원본에만 있다. 저장된 글에는 `[1학년]` 표시가 남아 있지 않아서
        (성적표를 걷어낼 때 함께 지워졌다), 이미 올린 생기부의 학년은 원본을
        다시 읽는 것 말고는 알 방법이 없다. 지어내지는 않는다 — 원본이 없으면
        학년 없이 과목만 정리한다.
        """
        row = (
            await session.execute(
                select(DocumentFileRow).where(DocumentFileRow.user_id == user_id)
            )
        ).scalar_one_or_none()
        if row is None:
            return []
        try:
            parsed = parse_pdf_bytes(row.content)
        except Exception as exc:  # noqa: BLE001 — 원본이 깨졌다고 정리를 막지 않는다
            logger.warning("정리용 PDF 재파싱 실패 user=%s: %s", user_id, exc)
            return []
        return [
            (subject, grade, content)
            for section_type, subject, grade, content in _merge_sections_by_type(parsed.sections)
            if section_type is SectionType.SUBJECT_SPECIFIC
        ]

    async def split_subject_sections(
        self, session: AsyncSession | None, user_id: str
    ) -> list[DocumentSection]:
        """세특을 학년·과목 단위로 정리한다.

        두 가지 어긋남을 한 번에 바로잡는다.

        1. **덩어리** — 예전에 올린 생기부는 세특 전체가 한 행에 `[과목] 본문` 꼴로
           이어져 있다. 표시를 되짚어 과목마다 행을 만든다.
        2. **중복** — 같은 생기부를 두 번 올리면 같은 과목이 두 벌이 된다.

        원본 PDF 가 남아 있으면 거기서 다시 읽어 **학년까지** 붙인다. 이때
        PDF 에서 온 것이 확실한 행만 갈아 끼운다 — 손으로 쓴 글은 건드리지 않는다.
        (한 글자라도 원본에 없는 행은 그대로 둔다.)

        여러 번 눌러도 안전하다. 돌려주는 값은 정리 뒤의 세특 행 전부다.
        """
        now = await utcnow()

        if is_offline_demo():
            # 메모리 모드에는 원본 PDF 보관이 없다. 과목만 가르고 중복만 걷는다.
            db = get_memory_db()
            docs = [
                d
                for d in list(db.documents.values())
                if d.user_id == user_id and d.section_type == SectionType.SUBJECT_SPECIFIC.value
            ]
            seen: set[tuple[str, str]] = set()
            out: list[DocumentSection] = []
            for doc in docs:
                blocks = split_subject_blocks(doc.content) or [
                    (doc.subject_id or "", doc.content)
                ]
                first = True
                for name, body in blocks:
                    key = (name, _normalize(body))
                    if key in seen:
                        continue
                    seen.add(key)
                    if first:
                        doc.subject_id = name or None
                        doc.content = body
                        doc.updated_at = now
                        out.append(self._to_schema_from_memory(doc))
                        first = False
                        continue
                    extra = MemoryDocument(
                        id=str(uuid4()),
                        user_id=user_id,
                        section_type=doc.section_type,
                        content=body,
                        period_id=doc.period_id,
                        subject_id=name or None,
                        version=1,
                        source=doc.source,
                        created_at=doc.created_at,
                        updated_at=now,
                    )
                    db.documents[extra.id] = extra
                    out.append(self._to_schema_from_memory(extra))
                if first:  # 이 행의 내용이 전부 다른 행과 겹쳤다 — 중복이다
                    db.documents.pop(doc.id, None)
            return out

        rows = list(
            (
                await session.execute(
                    select(DocumentSectionRow).where(
                        DocumentSectionRow.user_id == user_id,
                        DocumentSectionRow.section_type == SectionType.SUBJECT_SPECIFIC.value,
                    )
                )
            )
            .scalars()
            .all()
        )
        targets = await self._pdf_subject_blocks(session, user_id)
        # 원본에서 나온 조각들. 이 안에 다 들어 있는 행만 갈아 끼운다.
        from_pdf = {_normalize(c) for _, _, body in targets for c in body.split("\n\n")}
        # 전처리가 달라졌을 때를 대비한 느슨한 대조 — 앞부분만 견준다.
        from_pdf_packed = [_packed(c) for _, _, body in targets for c in body.split("\n\n")]

        kept: list[DocumentSectionRow] = []
        replaceable: list[DocumentSectionRow] = []
        oldest = min((r.created_at for r in rows), default=now)
        source = next((r.source for r in rows), "pdf_parsed")

        for row in rows:
            blocks = split_subject_blocks(row.content) or [(row.subject_id or "", row.content)]
            chunks = [_normalize(c) for _, body in blocks for c in body.split("\n\n")]

            def came_from_pdf(chunk: str) -> bool:
                if chunk in from_pdf:
                    return True
                return any(
                    any(probe in target for target in from_pdf_packed)
                    for probe in _probes(chunk)
                )

            if from_pdf and chunks and all(came_from_pdf(c) for c in chunks):
                replaceable.append(row)  # 원본에서 그대로 다시 만들 수 있다
            else:
                kept.append(row)

        # 이미 원본과 똑같이 정리돼 있으면 손대지 않는다. 매번 갈아 끼우면 내용은
        # 같은데 문서 id 만 바뀌어, 열어 두었던 화면이 없는 문서를 가리키게 된다.
        want = {(s, g, _normalize(b)) for s, g, b in targets}
        have = {(r.subject_id, r.period_id, _normalize(r.content)) for r in replaceable}
        rebuild = bool(from_pdf) and want != have
        if not rebuild:
            kept.extend(replaceable)
            replaceable = []
        for row in replaceable:
            await session.delete(row)

        made: list[DocumentSection] = []
        if rebuild:
            for subject, grade, body in targets:
                extra = DocumentSectionRow(
                    id=str(uuid4()),
                    user_id=user_id,
                    section_type=SectionType.SUBJECT_SPECIFIC.value,
                    content=body,
                    period_id=grade,
                    subject_id=subject,
                    version=1,
                    source=source,
                    created_at=oldest,
                    updated_at=now,
                )
                session.add(extra)
                made.append(self._to_schema_from_row(extra))

        # 원본이 없거나, 손으로 쓴 글이라 남겨 둔 행들 — 덩어리면 여기서 가른다.
        seen_kept: set[tuple[str, str]] = set()
        for row in kept:
            blocks = split_subject_blocks(row.content) or [(row.subject_id or "", row.content)]
            first = True
            for name, body in blocks:
                key = (name, _normalize(body))
                if key in seen_kept:
                    continue
                seen_kept.add(key)
                if first:
                    # 바뀐 게 없으면 시각도 건드리지 않는다 — 정리를 눌렀다고
                    # 모든 영역이 "방금 고침"이 되면 최근 활동이 거짓말을 한다.
                    if row.content != body or row.subject_id != (name or row.subject_id):
                        row.subject_id = name or row.subject_id
                        row.content = body
                        row.updated_at = now
                    made.append(self._to_schema_from_row(row))
                    first = False
                    continue
                extra = DocumentSectionRow(
                    id=str(uuid4()),
                    user_id=user_id,
                    section_type=row.section_type,
                    content=body,
                    period_id=row.period_id,
                    subject_id=name or None,
                    version=1,
                    source=row.source,
                    created_at=row.created_at,
                    updated_at=now,
                )
                session.add(extra)
                made.append(self._to_schema_from_row(extra))
            if first:  # 내용이 전부 다른 행과 겹쳤다
                await session.delete(row)

        # 세특 말고 다른 영역(행동특성·자율활동·독서 …)도 같은 원본에서 다시
        # 읽어 넣는다. 전처리가 좋아졌는데 세특만 새로워지면 반쪽이다.
        all_blocks = await self._pdf_blocks(session, user_id)
        if all_blocks:
            touched = await self._refresh_other_sections(session, user_id, all_blocks, now)
            if touched:
                logger.info("다른 영역 %d개를 새 전처리로 다시 읽음 user=%s", touched, user_id)

        await session.commit()
        return made

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

    async def delete_section(
        self,
        session: AsyncSession | None,
        user_id: str,
        section_id: str,
    ) -> bool:
        """한 영역을 지운다. 그래프 노드는 건드리지 않는다 — 노드는 학생이
        직접 고친 것일 수 있어서, 글을 지웠다고 함께 지우면 손으로 쓴 것까지
        말없이 사라진다. 출처 문장만 안 보이게 된다."""
        if is_offline_demo():
            docs = get_memory_db().documents
            doc = docs.get(section_id)
            if not doc or doc.user_id != user_id:
                return False
            del docs[section_id]
            return True

        result = await session.execute(
            select(DocumentSectionRow).where(
                DocumentSectionRow.user_id == user_id,
                DocumentSectionRow.id == section_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return False
        await session.delete(row)
        await session.commit()
        return True

    async def start_pdf_import(
        self,
        session: AsyncSession | None,
        user_id: str,
        filename: str,
        file_bytes: bytes,
        owner_name: str = "",
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

        await self._complete_pdf_import(session, user_id, job_id, parsed, owner_name)
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
        subject: str | None = None,
        grade: str | None = None,
    ) -> str:
        section_id = str(uuid4())
        if is_offline_demo():
            section = MemoryDocument(
                id=section_id,
                user_id=user_id,
                section_type=section_type.value,
                content=content,
                period_id=grade,
                subject_id=subject,
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
            subject_id=subject,
            period_id=grade,
            version=1,
            source="pdf_parsed",
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        return section_id

    async def _extract_keywords(self, parsed: ParsedPdf) -> tuple[list[ExtractedKeyword], str]:
        """Pick keywords for graph nodes, tagging the extractor with the PDF pipeline."""
        sections = _sections_for_extraction(parsed.sections)
        keywords, extractor = await extract_keywords(
            sections=sections,
            token_freqs=parsed.token_frequencies,
            limit=_node_budget(len(sections)),
            rule_source="pdf_tokens",
        )
        return keywords, f"pymupdf+{extractor}"

    async def _complete_pdf_import(
        self,
        session: AsyncSession | None,
        user_id: str,
        job_id: str,
        parsed: ParsedPdf,
        owner_name: str = "",
    ) -> None:
        now = await utcnow()
        section_ids: list[str] = []

        for section_type, subject, grade, content in _merge_sections_by_type(parsed.sections):
            section_ids.append(
                await self._persist_section(
                    session,
                    user_id,
                    section_type=section_type,
                    content=content,
                    subject=subject,
                    grade=grade,
                    now=now,
                )
            )

        doc_node = await self.graph.create_node(
            user_id,
            node_type=NodeType.DOCUMENT,
            label=_document_label(owner_name),
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

        # 층을 세운다. 개념 → 구획 → 학년 → 문서.
        # 여기서 하지 않으면 가져온 직후의 그래프만 별 모양으로 남는다.
        structure = await rebuild_structure(
            self.graph, user_id, await self.list_sections(session, user_id)
        )

        result_payload = {
            "document_section_ids": section_ids,
            "structure": structure,
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
