"""Disk-safe product APIs: comments, notifications, forms, settings, voice, stats.

Audio for STT is processed in-memory only (max 5MB) and never written to disk.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.factory import get_graph_analyze_adapter
from app.config import get_settings
from app.db.factory import get_graph_store, is_offline_demo
from app.db.memory import MemoryUser, get_memory_db
from app.db.postgres import (
    CommentRow,
    FormDocRow,
    NotificationRow,
    UserRow,
    UserSettingsRow,
    VoiceSessionRow,
)
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.parsers.pdf_extractor import extract_text_from_pdf_bytes
from app.services import account_deletion, form_writer
from app.services.document_service import DocumentService
from app.schemas.product import (
    CommentCreate,
    CommentOut,
    FormDocOut,
    FormGenerateRequest,
    FormPatchRequest,
    FormTemplateOut,
    NotificationOut,
    SettingsOut,
    SettingsPatch,
    VoiceSessionCreate,
    VoiceSessionOut,
    VoiceSessionPatch,
)

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5MB — keep RAM/disk pressure low

# 자기소개서는 없다. 2024학년도 대입부터 폐지됐고, 남아 있더라도 남이 써 준
# 자기소개서를 내는 일을 거들 이유가 없다. 여기 있는 것은 전부 **자기 기록을
# 정리하는 보고서**다.
FORM_TEMPLATES: list[FormTemplateOut] = [
    FormTemplateOut(
        id="setuk",
        title="세특 요약 보고서",
        category="세특",
        description="교과 학습 내용과 탐구 활동을 체계적으로 정리",
    ),
    FormTemplateOut(
        id="club",
        title="동아리 활동 보고서",
        category="동아리",
        description="동아리 활동 내용과 본인의 역할을 서술",
    ),
    FormTemplateOut(
        id="career",
        title="진로 포트폴리오",
        category="진로",
        description="진로 탐색 과정과 준비 현황을 종합",
    ),
    FormTemplateOut(
        id="reading",
        title="독서 감상문",
        category="독서",
        description="읽은 책의 핵심 내용과 본인의 생각을 연결",
    ),
    FormTemplateOut(
        id="service",
        title="봉사활동 에세이",
        category="봉사",
        description="봉사 경험을 통한 성장을 서술",
    ),
]

logger = logging.getLogger(__name__)

comments_router = APIRouter(prefix="/v1/students/me/comments", tags=["comments"])
notifications_router = APIRouter(prefix="/v1/students/me/notifications", tags=["notifications"])
forms_router = APIRouter(prefix="/v1/students/me/forms", tags=["forms"])
settings_router = APIRouter(prefix="/v1/students/me/settings", tags=["settings"])
account_router = APIRouter(prefix="/v1/students/me/account", tags=["account"])
voice_router = APIRouter(prefix="/v1/students/me/voice", tags=["voice"])


def _now() -> datetime:
    return datetime.now(UTC)


def _comment_out(row: CommentRow | dict) -> CommentOut:
    if isinstance(row, dict):
        return CommentOut(**row)
    return CommentOut(
        id=row.id,
        author=row.author,
        type=row.type,
        target=row.target,
        content=row.content,
        reports=row.reports,
        replied=row.replied,
        created_at=row.created_at,
    )


def _notif_out(row: NotificationRow | dict) -> NotificationOut:
    if isinstance(row, dict):
        return NotificationOut(**row)
    return NotificationOut(
        id=row.id,
        icon=row.icon,
        title=row.title,
        body=row.body,
        read=row.read,
        created_at=row.created_at,
    )


def _form_out(row: FormDocRow | dict) -> FormDocOut:
    if isinstance(row, dict):
        return FormDocOut(**row)
    return FormDocOut(
        id=row.id,
        template_id=row.template_id,
        title=row.title,
        content=row.content,
        used_nodes=json.loads(row.used_nodes or "[]"),
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _voice_out(row: VoiceSessionRow | dict) -> VoiceSessionOut:
    if isinstance(row, dict):
        return VoiceSessionOut(**row)
    return VoiceSessionOut(
        id=row.id,
        title=row.title,
        status=row.status,
        duration_sec=row.duration_sec,
        transcript=row.transcript,
        keywords=json.loads(row.keywords or "[]"),
        participants=json.loads(row.participants or "[]"),
        stt_mode=row.stt_mode,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _ensure_seed_notifications(session: AsyncSession | None, user_id: str) -> None:
    """First visit: create a few system notifications so UI isn't empty."""
    if is_offline_demo():
        db = get_memory_db()
        notes = getattr(db, "notifications", None)
        if notes is None:
            db.notifications = {}  # type: ignore[attr-defined]
            notes = db.notifications
        if any(n["user_id"] == user_id for n in notes.values()):
            return
        now = _now()
        for title, body, icon in (
            ("환영합니다", "MentorBridgeX에 오신 것을 환영합니다.", "bell"),
            ("그래프 시작", "시드 키워드로 지식 그래프를 만들어 보세요.", "graph"),
            ("음성 STT", "녹음 후 STT로 활동 보고서를 작성할 수 있습니다.", "voice"),
        ):
            nid = str(uuid4())
            notes[nid] = {
                "id": nid,
                "user_id": user_id,
                "icon": icon,
                "title": title,
                "body": body,
                "read": False,
                "created_at": now,
            }
        return

    assert session is not None
    existing = await session.execute(
        select(NotificationRow.id).where(NotificationRow.user_id == user_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return
    now = _now()
    for title, body, icon in (
        ("환영합니다", "MentorBridgeX에 오신 것을 환영합니다.", "bell"),
        ("그래프 시작", "시드 키워드로 지식 그래프를 만들어 보세요.", "graph"),
        ("음성 STT", "녹음 후 STT로 활동 보고서를 작성할 수 있습니다.", "voice"),
    ):
        session.add(
            NotificationRow(
                id=str(uuid4()),
                user_id=user_id,
                icon=icon,
                title=title,
                body=body,
                read=False,
                created_at=now,
            )
        )
    await session.commit()


def _extract_keywords(text: str, limit: int = 8) -> list[str]:
    tokens = re.findall(r"[가-힣A-Za-z0-9]{2,}", text or "")
    seen: list[str] = []
    for t in tokens:
        if t not in seen:
            seen.append(t)
        if len(seen) >= limit:
            break
    return seen


async def _save_form(
    session: AsyncSession | None,
    user: UserRow | MemoryUser,
    *,
    template_id: str,
    title: str,
    content: str,
    sources: list[str],
) -> FormDocOut:
    """만든 양식을 저장한다. 템플릿 생성과 올린 양식 채우기가 함께 쓴다.

    `used_nodes` 칸에 근거로 쓴 **생기부 구획** 이름을 넣는다. 이름은 예전
    것을 그대로 둔다 — 마이그레이션 도구가 없어 칸을 새로 만들 수 없고,
    담기는 뜻은 처음부터 "이 문서가 무엇에서 나왔는가" 하나였다.
    """
    now = _now()
    fid = str(uuid4())

    if is_offline_demo():
        db = get_memory_db()
        if not hasattr(db, "forms"):
            db.forms = {}  # type: ignore[attr-defined]
        row = {
            "id": fid,
            "user_id": user.id,
            "template_id": template_id,
            "title": title,
            "content": content,
            "used_nodes": sources,
            "status": "완료",
            "created_at": now,
            "updated_at": now,
        }
        db.forms[fid] = row
        return _form_out(row)

    assert session is not None
    row = FormDocRow(
        id=fid,
        user_id=user.id,
        template_id=template_id,
        title=title,
        content=content,
        used_nodes=json.dumps(sources, ensure_ascii=False),
        status="완료",
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _form_out(row)


async def _write_form(
    template_id: str,
    title: str,
    description: str,
    name: str,
    sections: list,
) -> tuple[str, str, list[str]]:
    """양식 본문을 쓴다. 돌려주는 값은 (본문, 무엇으로 썼는지, 근거로 쓴 구획).

    예전에는 그래프 노드 이름을 문장 틀에 끼워 넣었다. "○○ 학생은 빅데이터를
    중심으로 A, B, C에 대해 탐구하였습니다" — 누구에게나 들어맞는 문장이라
    그대로 낼 수 없고, 결국 학생이 처음부터 다시 썼다. 이제 저장된 생기부 글을
    근거로 쓴다.
    """
    blocks = form_writer.evidence_blocks(
        sections, form_writer.SECTION_FOR_TEMPLATE.get(template_id)
    )
    evidence = form_writer.evidence_text(blocks)
    sources = form_writer.evidence_sources(blocks)
    adapter = get_graph_analyze_adapter()
    if adapter is not None and evidence:
        try:
            text = await adapter.write_prose(
                form_writer.report_prompt(title, description, name, evidence)
            )
            if text:
                return text, f"claude:{adapter.model}", sources
        except Exception as exc:  # noqa: BLE001 — 못 썼다고 화면이 죽으면 안 된다
            logger.warning("양식 작성 실패, 근거만 모아 넘김: %s", exc)
    return form_writer.fallback_report(title, name, evidence), "evidence_only", sources


# ── Comments ──────────────────────────────────────────────────


@comments_router.get("", response_model=list[CommentOut])
async def list_comments(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[CommentOut]:
    if is_offline_demo():
        db = get_memory_db()
        items = getattr(db, "comments", {})
        rows = [v for v in items.values() if v["user_id"] == user.id]
        rows.sort(key=lambda x: x["created_at"], reverse=True)
        return [_comment_out(r) for r in rows]

    assert session is not None
    result = await session.execute(
        select(CommentRow)
        .where(CommentRow.user_id == user.id)
        .order_by(CommentRow.created_at.desc())
    )
    return [_comment_out(r) for r in result.scalars().all()]


@comments_router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    body: CommentCreate,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> CommentOut:
    now = _now()
    author = body.author or user.display_name
    cid = str(uuid4())
    if is_offline_demo():
        db = get_memory_db()
        if not hasattr(db, "comments"):
            db.comments = {}  # type: ignore[attr-defined]
        row = {
            "id": cid,
            "user_id": user.id,
            "author": author,
            "type": body.type,
            "target": body.target,
            "content": body.content,
            "reports": 0,
            "replied": False,
            "created_at": now,
        }
        db.comments[cid] = row
        await _push_notification(
            user.id,
            title="새 코멘트",
            body=f"{author}님이 [{body.target}]에 코멘트를 남겼습니다.",
            icon="comment",
            category="comment",
        )
        return _comment_out(row)

    assert session is not None
    row = CommentRow(
        id=cid,
        user_id=user.id,
        author=author,
        type=body.type,
        target=body.target,
        content=body.content,
        reports=0,
        replied=False,
        created_at=now,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    await _push_notification(
        user.id,
        title="새 코멘트",
        body=f"{author}님이 [{body.target}]에 코멘트를 남겼습니다.",
        icon="comment",
        session=session,
        category="comment",
    )
    return _comment_out(row)


@comments_router.post("/{comment_id}/report", response_model=CommentOut)
async def report_comment(
    comment_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> CommentOut:
    if is_offline_demo():
        db = get_memory_db()
        row = getattr(db, "comments", {}).get(comment_id)
        if not row or row["user_id"] != user.id:
            raise AppError("COMMENT_NOT_FOUND", "코멘트를 찾을 수 없습니다.", 404)
        row["reports"] = int(row.get("reports", 0)) + 1
        return _comment_out(row)

    assert session is not None
    result = await session.execute(
        select(CommentRow).where(CommentRow.id == comment_id, CommentRow.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("COMMENT_NOT_FOUND", "코멘트를 찾을 수 없습니다.", 404)
    row.reports += 1
    await session.commit()
    await session.refresh(row)
    return _comment_out(row)


@comments_router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> None:
    if is_offline_demo():
        db = get_memory_db()
        row = getattr(db, "comments", {}).get(comment_id)
        if not row or row["user_id"] != user.id:
            raise AppError("COMMENT_NOT_FOUND", "코멘트를 찾을 수 없습니다.", 404)
        del db.comments[comment_id]
        return

    assert session is not None
    result = await session.execute(
        select(CommentRow).where(CommentRow.id == comment_id, CommentRow.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("COMMENT_NOT_FOUND", "코멘트를 찾을 수 없습니다.", 404)
    await session.delete(row)
    await session.commit()


# ── Notifications ─────────────────────────────────────────────


@notifications_router.get("", response_model=list[NotificationOut])
async def list_notifications(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[NotificationOut]:
    await _ensure_seed_notifications(session, user.id)
    if is_offline_demo():
        rows = [v for v in get_memory_db().notifications.values() if v["user_id"] == user.id]  # type: ignore[attr-defined]
        rows.sort(key=lambda x: x["created_at"], reverse=True)
        return [_notif_out(r) for r in rows]

    assert session is not None
    result = await session.execute(
        select(NotificationRow)
        .where(NotificationRow.user_id == user.id)
        .order_by(NotificationRow.created_at.desc())
    )
    return [_notif_out(r) for r in result.scalars().all()]


@notifications_router.post("/read-all")
async def read_all_notifications(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> dict:
    if is_offline_demo():
        for n in get_memory_db().notifications.values():  # type: ignore[attr-defined]
            if n["user_id"] == user.id:
                n["read"] = True
        return {"ok": True}

    assert session is not None
    result = await session.execute(
        select(NotificationRow).where(
            NotificationRow.user_id == user.id, NotificationRow.read.is_(False)
        )
    )
    for row in result.scalars().all():
        row.read = True
    await session.commit()
    return {"ok": True}


@notifications_router.patch("/{notification_id}/read", response_model=NotificationOut)
async def read_notification(
    notification_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> NotificationOut:
    if is_offline_demo():
        row = get_memory_db().notifications.get(notification_id)  # type: ignore[attr-defined]
        if not row or row["user_id"] != user.id:
            raise AppError("NOTIF_NOT_FOUND", "알림을 찾을 수 없습니다.", 404)
        row["read"] = True
        return _notif_out(row)

    assert session is not None
    result = await session.execute(
        select(NotificationRow).where(
            NotificationRow.id == notification_id, NotificationRow.user_id == user.id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("NOTIF_NOT_FOUND", "알림을 찾을 수 없습니다.", 404)
    row.read = True
    await session.commit()
    await session.refresh(row)
    return _notif_out(row)


# ── Forms ─────────────────────────────────────────────────────


@forms_router.get("/templates", response_model=list[FormTemplateOut])
async def list_templates(
    _user: UserRow | MemoryUser = Depends(get_current_user),
) -> list[FormTemplateOut]:
    return FORM_TEMPLATES


# 올릴 수 있는 양식 파일. 학교가 주는 것은 대개 PDF 아니면 글 파일이다.
_FORM_MAX_BYTES = 5 * 1024 * 1024
_FORM_TEXT_TYPES = {"text/plain", "text/markdown", "text/csv", ""}


@forms_router.post("/fill", response_model=FormDocOut, status_code=status.HTTP_201_CREATED)
async def fill_form(
    file: UploadFile = File(...),
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> FormDocOut:
    """학교에서 받은 양식을 올리면 항목을 찾아 채운다.

    파일 자체는 **보관하지 않는다.** 글자만 뽑아 쓰고 바이트는 버린다 —
    남의 양식을 우리가 쥐고 있을 이유가 없다.
    """
    data = await file.read()
    if not data:
        raise AppError("FORM_FILE_EMPTY", "빈 파일입니다.", 400)
    if len(data) > _FORM_MAX_BYTES:
        raise AppError("FORM_FILE_TOO_LARGE", "5MB 이하 파일만 올릴 수 있습니다.", 413)

    name = (file.filename or "양식").rsplit("/", 1)[-1]
    ctype = (file.content_type or "").split(";")[0].strip()
    if ctype == "application/pdf" or name.lower().endswith(".pdf"):
        try:
            text = extract_text_from_pdf_bytes(data)
        except Exception as exc:  # noqa: BLE001
            raise AppError("FORM_FILE_UNREADABLE", "PDF 를 읽지 못했습니다.", 400) from exc
    elif ctype in _FORM_TEXT_TYPES or name.lower().endswith((".txt", ".md")):
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("cp949", errors="replace")
    else:
        raise AppError(
            "FORM_FILE_TYPE",
            "PDF 또는 글 파일(.txt, .md)만 읽을 수 있습니다. 한글(.hwp)·워드(.docx)는 PDF 로 저장해 올려 주세요.",
            400,
        )

    prompts = form_writer.find_prompts(text)
    if not prompts:
        raise AppError(
            "FORM_NO_PROMPTS",
            "채울 항목을 찾지 못했습니다. 물음이 줄 단위로 적힌 양식인지 확인해 주세요.",
            422,
        )

    sections = await DocumentService().list_sections(session, user.id)
    blocks = form_writer.evidence_blocks(sections)
    evidence = form_writer.evidence_text(blocks)
    sources = form_writer.evidence_sources(blocks)
    adapter = get_graph_analyze_adapter()
    writer = "evidence_only"
    content = ""
    if adapter is not None and evidence:
        try:
            content = await adapter.write_prose(
                form_writer.fill_prompt(prompts, user.display_name, evidence),
                max_tokens=4000,
            )
            writer = f"claude:{adapter.model}"
        except Exception as exc:  # noqa: BLE001
            logger.warning("양식 채우기 실패, 항목만 넘김: %s", exc)
    if not content:
        # 못 채웠어도 찾아낸 항목은 돌려준다. 빈손으로 보내면 다시 올려야 한다.
        listed = "\n\n".join(f"## {p}\n\n" for p in prompts)
        content = f"# {name}\n\n항목은 찾았지만 지금은 채우지 못했습니다.\n\n{listed}"

    logger.info(
        "양식 채움 user=%s file=%s 항목=%d writer=%s 근거=%d구획",
        user.id, name, len(prompts), writer, len(sources),
    )
    return await _save_form(
        session, user, template_id="upload", title=name, content=content, sources=sources
    )


@forms_router.get("", response_model=list[FormDocOut])
async def list_forms(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[FormDocOut]:
    if is_offline_demo():
        db = get_memory_db()
        items = getattr(db, "forms", {})
        rows = [v for v in items.values() if v["user_id"] == user.id]
        rows.sort(key=lambda x: x["created_at"], reverse=True)
        return [_form_out(r) for r in rows]

    assert session is not None
    result = await session.execute(
        select(FormDocRow)
        .where(FormDocRow.user_id == user.id)
        .order_by(FormDocRow.created_at.desc())
    )
    return [_form_out(r) for r in result.scalars().all()]


@forms_router.post("/generate", response_model=FormDocOut, status_code=status.HTTP_201_CREATED)
async def generate_form(
    body: FormGenerateRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> FormDocOut:
    tmpl = next((t for t in FORM_TEMPLATES if t.id == body.template_id), None)
    if not tmpl:
        raise AppError("FORM_TEMPLATE_NOT_FOUND", "템플릿을 찾을 수 없습니다.", 404)

    sections = await DocumentService().list_sections(session, user.id)
    content, writer, sources = await _write_form(
        tmpl.id, tmpl.title, tmpl.description, user.display_name, sections
    )
    logger.info(
        "양식 생성 user=%s template=%s writer=%s 근거=%d구획",
        user.id, tmpl.id, writer, len(sources),
    )
    return await _save_form(
        session,
        user,
        template_id=tmpl.id,
        title=body.title or f"{tmpl.title} — {user.display_name}",
        content=content,
        sources=sources,
    )


@forms_router.get("/{form_id}", response_model=FormDocOut)
async def get_form(
    form_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> FormDocOut:
    if is_offline_demo():
        row = getattr(get_memory_db(), "forms", {}).get(form_id)
        if not row or row["user_id"] != user.id:
            raise AppError("FORM_NOT_FOUND", "양식을 찾을 수 없습니다.", 404)
        return _form_out(row)

    assert session is not None
    result = await session.execute(
        select(FormDocRow).where(FormDocRow.id == form_id, FormDocRow.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("FORM_NOT_FOUND", "양식을 찾을 수 없습니다.", 404)
    return _form_out(row)


@forms_router.patch("/{form_id}", response_model=FormDocOut)
async def patch_form(
    form_id: str,
    body: FormPatchRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> FormDocOut:
    now = _now()
    if is_offline_demo():
        row = getattr(get_memory_db(), "forms", {}).get(form_id)
        if not row or row["user_id"] != user.id:
            raise AppError("FORM_NOT_FOUND", "양식을 찾을 수 없습니다.", 404)
        if body.title is not None:
            row["title"] = body.title
        if body.content is not None:
            row["content"] = body.content
        row["updated_at"] = now
        return _form_out(row)

    assert session is not None
    result = await session.execute(
        select(FormDocRow).where(FormDocRow.id == form_id, FormDocRow.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("FORM_NOT_FOUND", "양식을 찾을 수 없습니다.", 404)
    if body.title is not None:
        row.title = body.title
    if body.content is not None:
        row.content = body.content
    row.updated_at = now
    await session.commit()
    await session.refresh(row)
    return _form_out(row)


# ── Account ───────────────────────────────────────────────────


@account_router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    confirm_email: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> None:
    """계정과 딸린 모든 기록을 지운다. 되돌릴 수 없다.

    자기 이메일을 다시 적게 한다. 되돌릴 수 없는 일에는 "정말요?" 한 번보다
    **직접 쓰는 한 줄**이 낫다 — 확인 창은 눈을 감고도 눌리지만, 자기 주소를
    옮겨 적으려면 무엇을 지우는지 한 번은 읽어야 한다.
    """
    if (confirm_email or "").strip().lower() != (user.email or "").lower():
        raise AppError(
            "ACCOUNT_CONFIRM_MISMATCH",
            "이메일이 맞지 않습니다. 로그인한 계정의 이메일을 그대로 적어 주세요.",
            400,
        )
    if is_offline_demo():
        raise AppError("ACCOUNT_DELETE_UNAVAILABLE", "데모 모드에서는 지울 수 없습니다.", 503)

    assert session is not None
    await account_deletion.delete_account(session, user.id)


# ── Settings ──────────────────────────────────────────────────


"""알림 스위치의 기본값 — **여기 있는 것만 화면에 스위치로 선다.**

「주간 리포트(이메일)」와 「푸시 알림」을 걷었다. 메일을 보내는 곳도 브라우저
푸시를 받는 곳도 서버에 없어서, 켜도 꺼도 아무 일이 일어나지 않았다.
"""
DEFAULT_PREFS = {"comment": True, "activity": True}


@settings_router.get("", response_model=SettingsOut)
async def get_settings_me(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> SettingsOut:
    if is_offline_demo():
        db = get_memory_db()
        prefs = getattr(db, "settings", {}).get(user.id, DEFAULT_PREFS)
        return SettingsOut(
            display_name=user.display_name,
            email=user.email,
            prefs=prefs,
            created_at=user.created_at,
        )

    assert session is not None
    result = await session.execute(
        select(UserSettingsRow).where(UserSettingsRow.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    prefs = json.loads(row.prefs) if row else DEFAULT_PREFS
    return SettingsOut(
        display_name=user.display_name,
        email=user.email,
        prefs=prefs,
        created_at=user.created_at,
    )


@settings_router.patch("", response_model=SettingsOut)
async def patch_settings_me(
    body: SettingsPatch,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> SettingsOut:
    now = _now()
    if is_offline_demo():
        db = get_memory_db()
        if not hasattr(db, "settings"):
            db.settings = {}  # type: ignore[attr-defined]
        prefs = db.settings.get(user.id, DEFAULT_PREFS)
        if body.prefs is not None:
            prefs = {**prefs, **body.prefs}
            db.settings[user.id] = prefs
        if body.display_name:
            user.display_name = body.display_name
        return SettingsOut(
            display_name=user.display_name,
            email=user.email,
            prefs=prefs,
            created_at=user.created_at,
        )

    assert session is not None
    if body.display_name:
        user.display_name = body.display_name  # type: ignore[union-attr]
    result = await session.execute(
        select(UserSettingsRow).where(UserSettingsRow.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    prefs = json.loads(row.prefs) if row else DEFAULT_PREFS
    if body.prefs is not None:
        prefs = {**prefs, **body.prefs}
    if row:
        row.prefs = json.dumps(prefs, ensure_ascii=False)
        row.updated_at = now
    else:
        session.add(
            UserSettingsRow(
                user_id=user.id,
                prefs=json.dumps(prefs, ensure_ascii=False),
                updated_at=now,
            )
        )
    await session.commit()
    return SettingsOut(
        display_name=user.display_name,
        email=user.email,
        prefs=prefs,
        created_at=user.created_at,
    )


# ── Voice ─────────────────────────────────────────────────────


@voice_router.post("/dictation")
async def dictate(
    request: Request,
    user: UserRow | MemoryUser = Depends(get_current_user),  # noqa: ARG001 — 인증만 필요
    file: UploadFile = File(...),
) -> dict:
    """받아쓰기 — 음성을 글로 옮겨 그대로 돌려준다.

    AI 입력창의 마이크 버튼이 쓴다. 녹음 세션(voice_sessions)과 달리 아무것도
    저장하지 않는다. 입력창에 넣을 문장 하나가 필요할 뿐인데 세션 레코드가
    쌓이면 "음성 세션" 목록이 의미 없는 항목으로 채워진다.

    STT 를 못 쓰면 모의 문장을 만들어주지 않는다 — 녹음 세션과 달리 여기서는
    가짜 문장이 곧바로 질문으로 전송되기 때문이다. 실패를 그대로 알린다.
    """
    audio = await file.read()
    if not audio:
        raise AppError("VOICE_EMPTY", "녹음된 소리가 없습니다.", 400)
    if len(audio) > MAX_AUDIO_BYTES:
        raise AppError(
            "VOICE_AUDIO_TOO_LARGE",
            f"오디오는 {MAX_AUDIO_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
            413,
        )

    settings = get_settings()
    stt_service = getattr(request.app.state, "stt_service", None)
    if not stt_service or not settings.daglo_api_token:
        raise AppError("STT_UNAVAILABLE", "음성 인식이 설정되지 않았습니다.", 503)

    try:
        result = await stt_service.sync_short(
            file.filename or "audio.webm", audio, file.content_type
        )
    except Exception as exc:  # noqa: BLE001 — 외부 서비스 실패를 사용자 메시지로 바꾼다
        logger.warning("받아쓰기 실패 user=%s: %s", user.id, exc)
        raise AppError("STT_FAILED", "음성을 인식하지 못했습니다.", 502) from exc
    finally:
        del audio  # 바이트는 최대한 빨리 버린다

    text = (result.transcript or "").strip()
    if not text:
        raise AppError("STT_EMPTY", "말소리를 알아듣지 못했습니다. 다시 시도해 주세요.", 422)
    return {"text": text}


@voice_router.get("/sessions", response_model=list[VoiceSessionOut])
async def list_voice_sessions(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[VoiceSessionOut]:
    if is_offline_demo():
        all_v = getattr(get_memory_db(), "voice", {}).values()
        rows = [v for v in all_v if v["user_id"] == user.id]
        rows.sort(key=lambda x: x["created_at"], reverse=True)
        return [_voice_out(r) for r in rows]

    assert session is not None
    result = await session.execute(
        select(VoiceSessionRow)
        .where(VoiceSessionRow.user_id == user.id)
        .order_by(VoiceSessionRow.created_at.desc())
    )
    return [_voice_out(r) for r in result.scalars().all()]


@voice_router.post("/sessions", response_model=VoiceSessionOut, status_code=status.HTTP_201_CREATED)
async def create_voice_session(
    body: VoiceSessionCreate,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> VoiceSessionOut:
    now = _now()
    vid = str(uuid4())
    data = {
        "id": vid,
        "user_id": user.id,
        "title": body.title,
        "status": "녹음 중",
        "duration_sec": 0,
        "transcript": "",
        "keywords": [],
        "participants": [user.display_name],
        "stt_mode": "mock",
        "created_at": now,
        "updated_at": now,
    }
    if is_offline_demo():
        db = get_memory_db()
        if not hasattr(db, "voice"):
            db.voice = {}  # type: ignore[attr-defined]
        db.voice[vid] = data
        return _voice_out(data)

    assert session is not None
    row = VoiceSessionRow(
        id=vid,
        user_id=user.id,
        title=body.title,
        status="녹음 중",
        duration_sec=0,
        transcript="",
        keywords="[]",
        participants=json.dumps([user.display_name], ensure_ascii=False),
        stt_mode="mock",
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _voice_out(row)


@voice_router.get("/sessions/{session_id}", response_model=VoiceSessionOut)
async def get_voice_session(
    session_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> VoiceSessionOut:
    if is_offline_demo():
        row = getattr(get_memory_db(), "voice", {}).get(session_id)
        if not row or row["user_id"] != user.id:
            raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
        return _voice_out(row)

    assert session is not None
    result = await session.execute(
        select(VoiceSessionRow).where(
            VoiceSessionRow.id == session_id, VoiceSessionRow.user_id == user.id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
    return _voice_out(row)


@voice_router.patch("/sessions/{session_id}", response_model=VoiceSessionOut)
async def patch_voice_session(
    session_id: str,
    body: VoiceSessionPatch,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> VoiceSessionOut:
    now = _now()
    if is_offline_demo():
        row = getattr(get_memory_db(), "voice", {}).get(session_id)
        if not row or row["user_id"] != user.id:
            raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
        for k in ("title", "status", "transcript", "duration_sec"):
            v = getattr(body, k)
            if v is not None:
                row[k] = v
        if body.keywords is not None:
            row["keywords"] = body.keywords
        if body.participants is not None:
            row["participants"] = body.participants
        row["updated_at"] = now
        return _voice_out(row)

    assert session is not None
    result = await session.execute(
        select(VoiceSessionRow).where(
            VoiceSessionRow.id == session_id, VoiceSessionRow.user_id == user.id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
    if body.title is not None:
        row.title = body.title
    if body.status is not None:
        row.status = body.status
    if body.transcript is not None:
        row.transcript = body.transcript
    if body.duration_sec is not None:
        row.duration_sec = body.duration_sec
    if body.keywords is not None:
        row.keywords = json.dumps(body.keywords, ensure_ascii=False)
    if body.participants is not None:
        row.participants = json.dumps(body.participants, ensure_ascii=False)
    row.updated_at = now
    await session.commit()
    await session.refresh(row)
    return _voice_out(row)


@voice_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice_session(
    session_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> None:
    """녹음을 지운다.

    지울 길이 아예 없었다. 잘못 눌러 생긴 0초짜리 녹음, 시험 삼아 한 녹음이
    목록에 그대로 쌓이는데 학생이 치울 방법이 없었다 — 자기 기록인데.

    소리는 애초에 저장하지 않으므로 여기서 사라지는 것은 **옮겨 적은 글**이다.
    되돌릴 수 없다.
    """
    if is_offline_demo():
        rows = getattr(get_memory_db(), "voice", {})
        row = rows.get(session_id)
        if not row or row["user_id"] != user.id:
            raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
        rows.pop(session_id, None)
        return

    assert session is not None
    result = await session.execute(
        select(VoiceSessionRow).where(
            VoiceSessionRow.id == session_id, VoiceSessionRow.user_id == user.id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
    await session.delete(row)
    await session.commit()


@voice_router.post("/sessions/{session_id}/transcribe", response_model=VoiceSessionOut)
async def transcribe_voice_session(
    session_id: str,
    request: Request,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
    file: UploadFile = File(...),
    duration_sec: int = Form(0),
) -> VoiceSessionOut:
    """Upload audio (≤5MB), STT in-memory, store transcript only."""
    audio = await file.read()
    if len(audio) > MAX_AUDIO_BYTES:
        raise AppError(
            "VOICE_AUDIO_TOO_LARGE",
            f"오디오는 {MAX_AUDIO_BYTES // (1024 * 1024)}MB 이하여야 합니다 (디스크/메모리 절약).",
            413,
        )

    settings = get_settings()
    transcript = ""
    stt_service = getattr(request.app.state, "stt_service", None)

    if stt_service and settings.daglo_api_token:
        # 인식이 되는 환경이다. 여기서는 **가짜 문장을 만들지 않는다** — 학생의
        # 기록으로 남는 글이라, 못 알아들었으면 못 알아들었다고 해야 한다.
        try:
            result = await stt_service.sync_short(
                file.filename or "audio.webm", audio, file.content_type
            )
            transcript = (result.transcript or "").strip()
            stt_mode = "daglo"
        except Exception as exc:  # noqa: BLE001 — 외부 서비스 실패로 저장까지 막지는 않는다
            # 조용히 모의로 떨어뜨리지 않는다. 예전에는 그래서 형식을 잘못 적어
            # 보내는 버그(webm 을 wav 라고 알림)가 몇 달간 "모의 STT" 로만 보였다.
            logger.warning("Daglo 받아쓰기 실패 user=%s session=%s: %s", user.id, session_id, exc)
            stt_mode = "failed"
    else:
        # 토큰이 없는 환경(로컬 데모)에서만 모의 문장을 만든다. 이때는 화면에도
        # stt_mode="mock" 이 그대로 나가므로 진짜 인식 결과와 헷갈리지 않는다.
        snap = await get_graph_store().get_snapshot(user.id)
        labels = [n.label for n in snap.nodes][:5]
        topic = ", ".join(labels) if labels else "학습 주제"
        transcript = (
            f"(모의 STT) {duration_sec}초 녹음본입니다. "
            f"오늘 논의 주제는 {topic} 입니다. "
            f"Daglo 토큰이 설정되면 실제 음성 인식 결과가 여기에 표시됩니다."
        )
        stt_mode = "mock"

    keywords = _extract_keywords(transcript)
    now = _now()
    del audio  # drop bytes ASAP

    if is_offline_demo():
        row = getattr(get_memory_db(), "voice", {}).get(session_id)
        if not row or row["user_id"] != user.id:
            raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
        row["transcript"] = transcript
        row["keywords"] = keywords
        row["duration_sec"] = duration_sec
        row["status"] = "검토 대기"
        row["stt_mode"] = stt_mode
        row["updated_at"] = now
        return _voice_out(row)

    assert session is not None
    result = await session.execute(
        select(VoiceSessionRow).where(
            VoiceSessionRow.id == session_id, VoiceSessionRow.user_id == user.id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AppError("VOICE_NOT_FOUND", "음성 세션을 찾을 수 없습니다.", 404)
    row.transcript = transcript
    row.keywords = json.dumps(keywords, ensure_ascii=False)
    row.duration_sec = duration_sec
    row.status = "검토 대기"
    row.stt_mode = stt_mode
    row.updated_at = now
    await session.commit()
    await session.refresh(row)
    return _voice_out(row)


# ── Notification helper ───────────────────────────────────────


async def _notif_enabled(
    user_id: str, category: str, session: AsyncSession | None
) -> bool:
    """이 사람이 이 갈래의 알림을 켜 두었는가.

    설정 화면의 스위치를 **여기서 읽는다.** 예전에는 어디에서도 읽지 않아서,
    꺼 놓아도 알림이 그대로 쌓였다 — 끌 수 없는 스위치였다.
    `system` 처럼 스위치가 없는 갈래는 늘 보낸다(점검 안내 같은 것).
    """
    if category not in DEFAULT_PREFS:
        return True
    if is_offline_demo():
        db = get_memory_db()
        prefs = getattr(db, "settings", {}).get(user_id, DEFAULT_PREFS)
    elif session is not None:
        result = await session.execute(
            select(UserSettingsRow).where(UserSettingsRow.user_id == user_id)
        )
        row = result.scalar_one_or_none()
        prefs = json.loads(row.prefs) if row else DEFAULT_PREFS
    else:
        return True
    return bool(prefs.get(category, DEFAULT_PREFS[category]))


async def _push_notification(
    user_id: str,
    title: str,
    body: str,
    icon: str = "bell",
    session: AsyncSession | None = None,
    category: str = "system",
) -> None:
    """자동 알림 생성 (이벤트 트리거용)."""
    if not await _notif_enabled(user_id, category, session):
        return
    nid = str(uuid4())
    now = _now()
    if is_offline_demo():
        db = get_memory_db()
        if not hasattr(db, "notifications"):
            db.notifications = {}  # type: ignore[attr-defined]
        db.notifications[nid] = {
            "id": nid, "user_id": user_id, "icon": icon,
            "title": title, "body": body, "read": False, "created_at": now,
        }
        return
    if session is not None:
        session.add(NotificationRow(
            id=nid, user_id=user_id, icon=icon,
            title=title, body=body, read=False, created_at=now,
        ))
        await session.commit()
