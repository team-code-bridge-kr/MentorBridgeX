import hashlib
from datetime import UTC, datetime

import fitz
from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.memory import MemoryUser
from app.db.postgres import DocumentFileRow, UserRow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.schemas.documents import (
    DocumentCreateRequest,
    DocumentPatchRequest,
    DocumentSection,
    ImportPdfResponse,
)
from app.services.document_service import DocumentService

router = APIRouter(prefix="/v1/students/me/documents", tags=["ontology-documents"])
service = DocumentService()

# 생기부 PDF 는 보통 1MB 안팎이다. 상한을 넉넉히 두되 DB 에 담는 만큼 무제한은 아니다.
MAX_FILE_BYTES = 20 * 1024 * 1024


@router.get("", response_model=list[DocumentSection])
async def list_documents(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[DocumentSection]:
    return await service.list_sections(session, user.id)


@router.post("", response_model=DocumentSection, status_code=status.HTTP_201_CREATED)
async def create_document(
    body: DocumentCreateRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> DocumentSection:
    return await service.create_section(session, user.id, body)


@router.patch("/{section_id}", response_model=DocumentSection)
async def patch_document(
    section_id: str,
    body: DocumentPatchRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> DocumentSection:
    section = await service.patch_section(session, user.id, section_id, body)
    if not section:
        raise AppError("DOC_NOT_FOUND", "문서 영역을 찾을 수 없습니다.", status_code=404)
    return section


@router.post("/split-subjects", response_model=list[DocumentSection])
async def split_subjects(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[DocumentSection]:
    """세특 덩어리를 과목별 영역으로 가른다.

    예전에 올린 생기부는 세특 46과목 21,000자가 한 행에 들어 있다. 글자는 하나도
    버리지 않고 `[과목]` 표시를 되짚어 나누기만 한다. 여러 번 불러도 안전하다.
    """
    return await service.split_subject_sections(session, user.id)


@router.post("/import-pdf", response_model=ImportPdfResponse)
async def import_pdf(
    file: UploadFile = File(...),
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> ImportPdfResponse:
    raw = await file.read()
    if not raw:
        raise AppError("PDF_EMPTY", "업로드된 PDF 파일이 비어 있습니다.", status_code=400)
    job_id = await service.start_pdf_import(
        session, user.id, file.filename or "upload.pdf", raw,
        owner_name=getattr(user, "display_name", "") or "",
    )
    return ImportPdfResponse(job_id=job_id)


# ── 원본 PDF 보관 ────────────────────────────────────────────
# 학생이 올린 생기부를 그대로 다시 볼 수 있게 원본을 보관한다.
# 민감한 개인정보라 세 가지를 지킨다:
#   1. 본인만 읽는다 (user_id 로만 조회하고 파일 id 를 밖으로 내보내지 않는다)
#   2. 캐시하지 않는다 (Cache-Control: no-store)
#   3. 삭제 경로를 제공한다 (DELETE — 계정 정리 때도 이걸 쓴다)


def _require_db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise AppError("DB_UNAVAILABLE", "이 기능은 오프라인 데모에서 지원하지 않습니다.", 503)
    return session


@router.put("/file", status_code=status.HTTP_200_OK)
async def put_document_file(
    file: UploadFile = File(...),
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> dict:
    """생기부 PDF 원본을 보관한다. 학생당 한 개 — 다시 올리면 교체된다."""
    db = _require_db(session)
    raw = await file.read()
    if not raw:
        raise AppError("PDF_EMPTY", "업로드된 PDF 파일이 비어 있습니다.", status_code=400)
    if len(raw) > MAX_FILE_BYTES:
        raise AppError(
            "PDF_TOO_LARGE",
            f"PDF 는 {MAX_FILE_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
            status_code=413,
        )
    if not raw.startswith(b"%PDF"):
        raise AppError("PDF_INVALID", "PDF 파일이 아닙니다.", status_code=400)

    # 쪽 수는 화면에서 미리 알려주는 데 쓴다. 여기서 못 읽으면 열 수 없는 파일이다.
    try:
        with fitz.open(stream=raw, filetype="pdf") as doc:
            page_count = doc.page_count
    except Exception as exc:  # noqa: BLE001
        raise AppError("PDF_INVALID", "PDF 를 열 수 없습니다.", status_code=400) from exc

    await db.execute(sa_delete(DocumentFileRow).where(DocumentFileRow.user_id == user.id))
    db.add(
        DocumentFileRow(
            user_id=user.id,
            filename=(file.filename or "생기부.pdf")[:300],
            byte_size=len(raw),
            page_count=page_count,
            sha256=hashlib.sha256(raw).hexdigest(),
            content=raw,
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    return {"page_count": page_count, "byte_size": len(raw), "filename": file.filename}


@router.get("/file/meta")
async def get_document_file_meta(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> dict:
    """보관 중인 원본이 있는지 — 내용은 빼고 정보만."""
    db = _require_db(session)
    row = (
        await db.execute(select(DocumentFileRow).where(DocumentFileRow.user_id == user.id))
    ).scalar_one_or_none()
    if row is None:
        return {"exists": False}
    return {
        "exists": True,
        "filename": row.filename,
        "byte_size": row.byte_size,
        "page_count": row.page_count,
        "created_at": row.created_at.isoformat(),
    }


@router.get("/file")
async def get_document_file(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> Response:
    """원본 PDF 를 내려준다. 본인 것만, 캐시 없이."""
    db = _require_db(session)
    row = (
        await db.execute(select(DocumentFileRow).where(DocumentFileRow.user_id == user.id))
    ).scalar_one_or_none()
    if row is None:
        raise AppError("PDF_NOT_FOUND", "보관된 생기부 PDF 가 없습니다.", status_code=404)
    return Response(
        content=row.content,
        media_type="application/pdf",
        headers={
            # 브라우저·프록시 어디에도 남기지 않는다
            "Cache-Control": "no-store, private",
            "Content-Disposition": "inline; filename=\"record.pdf\"",
        },
    )


@router.delete("/file")
async def delete_document_file(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> dict:
    """보관된 원본을 지운다. 계정 정리 때도 이 경로를 쓴다."""
    db = _require_db(session)
    await db.execute(sa_delete(DocumentFileRow).where(DocumentFileRow.user_id == user.id))
    await db.commit()
    return {"ok": True}
