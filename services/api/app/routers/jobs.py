import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import is_offline_demo
from app.db.memory import MemoryUser, get_memory_db
from app.db.postgres import JobRow, UserRow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.schemas.common import JobStatus

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobStatus)
async def get_job(
    job_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> JobStatus:
    if is_offline_demo():
        job = get_memory_db().jobs.get(job_id)
        if not job or job.user_id != user.id:
            raise AppError("DOC_NOT_FOUND", "작업을 찾을 수 없습니다.", status_code=404)
        return JobStatus(
            id=job.id,
            status=job.status,
            progress=job.progress,
            result=json.loads(job.result) if job.result else None,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    result = await session.execute(
        select(JobRow).where(JobRow.id == job_id, JobRow.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise AppError("DOC_NOT_FOUND", "작업을 찾을 수 없습니다.", status_code=404)
    return JobStatus(
        id=job.id,
        status=job.status,
        progress=job.progress,
        result=json.loads(job.result) if job.result else None,
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )
