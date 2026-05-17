from fastapi import APIRouter, Depends, File, UploadFile, status

from app.db.memory import MemoryUser
from app.db.postgres import UserRow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.schemas.documents import (
    DocumentCreateRequest,
    DocumentPatchRequest,
    DocumentSection,
    ImportPdfResponse,
)
from app.services.document_service import DocumentService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/v1/students/me/documents", tags=["ontology-documents"])
service = DocumentService()


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


@router.post("/import-pdf", response_model=ImportPdfResponse)
async def import_pdf(
    file: UploadFile = File(...),
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> ImportPdfResponse:
    job_id = await service.start_pdf_import(session, user.id, file.filename or "upload.pdf")
    return ImportPdfResponse(job_id=job_id)
