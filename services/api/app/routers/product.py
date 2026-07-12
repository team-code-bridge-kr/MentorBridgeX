"""Disk-safe product APIs: comments, notifications, forms, settings, voice, stats.

Audio for STT is processed in-memory only (max 5MB) and never written to disk.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    StatsOut,
    VoiceSessionCreate,
    VoiceSessionOut,
    VoiceSessionPatch,
)

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5MB — keep RAM/disk pressure low

FORM_TEMPLATES: list[FormTemplateOut] = [
    FormTemplateOut(
        id="saseo",
        title="대학 자기소개서",
        category="입시",
        description="학업 역량, 전공 선택 이유, 발전 가능성을 중심으로 작성",
        uses=1204,
    ),
    FormTemplateOut(
        id="setuk",
        title="세특 요약 보고서",
        category="세특",
        description="교과 학습 내용과 탐구 활동을 체계적으로 정리",
        uses=892,
    ),
    FormTemplateOut(
        id="club",
        title="동아리 활동 보고서",
        category="동아리",
        description="동아리 활동 내용과 본인의 역할을 서술",
        uses=567,
    ),
    FormTemplateOut(
        id="career",
        title="진로 포트폴리오",
        category="진로",
        description="진로 탐색 과정과 준비 현황을 종합",
        uses=423,
    ),
    FormTemplateOut(
        id="reading",
        title="독서 감상문",
        category="독서",
        description="읽은 책의 핵심 내용과 본인의 생각을 연결",
        uses=345,
    ),
    FormTemplateOut(
        id="service",
        title="봉사활동 에세이",
        category="봉사",
        description="봉사 경험을 통한 성장을 서술",
        uses=289,
    ),
]

comments_router = APIRouter(prefix="/v1/students/me/comments", tags=["comments"])
notifications_router = APIRouter(prefix="/v1/students/me/notifications", tags=["notifications"])
forms_router = APIRouter(prefix="/v1/students/me/forms", tags=["forms"])
settings_router = APIRouter(prefix="/v1/students/me/settings", tags=["settings"])
voice_router = APIRouter(prefix="/v1/students/me/voice", tags=["voice"])
stats_router = APIRouter(prefix="/v1/students/me/stats", tags=["stats"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


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


def _generate_form_content(template_id: str, name: str, nodes: list[str]) -> str:
    labels = nodes[:8] or ["학습 주제"]
    joined = ", ".join(labels)
    primary = labels[0]
    if template_id == "setuk":
        return (
            f"{name} 학생은 {primary}을(를) 중심으로 {joined}에 대해 탐구하였습니다. "
            f"수업과 연계한 자료를 검토하고, 핵심 개념을 그래프 노드로 정리하며 "
            f"탐구 과정을 심화하였습니다."
        )
    if template_id == "club":
        return (
            f"동아리 활동에서 {name} 학생은 {primary} 관련 논의를 주도하고 "
            f"{joined} 주제를 팀과 함께 정리하였습니다."
        )
    # default 자소서형
    return (
        f"저는 {primary}에 깊은 관심을 가지고 있으며, {joined} 영역을 중심으로 "
        f"학습을 심화해 왔습니다.\n\n"
        f"그래프 기반 기록으로 개념 간 연결을 정리하며, 향후 관련 전공 탐구를 "
        f"이어가고자 합니다."
    )


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
        select(NotificationRow).where(NotificationRow.user_id == user.id, NotificationRow.read.is_(False))
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
        select(FormDocRow).where(FormDocRow.user_id == user.id).order_by(FormDocRow.created_at.desc())
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

    snap = await get_graph_store().get_snapshot(user.id)
    nodes = [n.label for n in snap.nodes][:12]
    content = _generate_form_content(tmpl.id, user.display_name, nodes)
    now = _now()
    fid = str(uuid4())
    title = body.title or f"{tmpl.title} — {user.display_name}"

    if is_offline_demo():
        db = get_memory_db()
        if not hasattr(db, "forms"):
            db.forms = {}  # type: ignore[attr-defined]
        row = {
            "id": fid,
            "user_id": user.id,
            "template_id": tmpl.id,
            "title": title,
            "content": content,
            "used_nodes": nodes,
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
        template_id=tmpl.id,
        title=title,
        content=content,
        used_nodes=json.dumps(nodes, ensure_ascii=False),
        status="완료",
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _form_out(row)


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


# ── Settings ──────────────────────────────────────────────────


@settings_router.get("", response_model=SettingsOut)
async def get_settings_me(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> SettingsOut:
    default_prefs = {"comment": True, "system": True, "weekly": False, "push": True}
    if is_offline_demo():
        db = get_memory_db()
        prefs = getattr(db, "settings", {}).get(user.id, default_prefs)
        return SettingsOut(
            display_name=user.display_name,
            email=user.email,
            prefs=prefs,
            created_at=user.created_at,
        )

    assert session is not None
    result = await session.execute(select(UserSettingsRow).where(UserSettingsRow.user_id == user.id))
    row = result.scalar_one_or_none()
    prefs = json.loads(row.prefs) if row else default_prefs
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
        prefs = db.settings.get(user.id, {"comment": True, "system": True, "weekly": False, "push": True})
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
    result = await session.execute(select(UserSettingsRow).where(UserSettingsRow.user_id == user.id))
    row = result.scalar_one_or_none()
    prefs = json.loads(row.prefs) if row else {"comment": True, "system": True, "weekly": False, "push": True}
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


@voice_router.get("/sessions", response_model=list[VoiceSessionOut])
async def list_voice_sessions(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[VoiceSessionOut]:
    if is_offline_demo():
        rows = [v for v in getattr(get_memory_db(), "voice", {}).values() if v["user_id"] == user.id]
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
    stt_mode = "mock"
    transcript = ""
    stt_service = getattr(request.app.state, "stt_service", None)
    if stt_service and settings.daglo_api_token:
        try:
            result = await stt_service.sync_short(file.filename or "audio.webm", audio)
            transcript = (result.transcript or "").strip()
            stt_mode = "daglo"
        except Exception:
            transcript = ""
            stt_mode = "mock"

    if not transcript:
        # Lightweight mock so UI works without Daglo token / on failure
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


async def _push_notification(
    user_id: str,
    title: str,
    body: str,
    icon: str = "bell",
    session: AsyncSession | None = None,
) -> None:
    """자동 알림 생성 (이벤트 트리거용)."""
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


# ── Stats ─────────────────────────────────────────────────────

_SECTION_META = [
    ("subject_specific", "세특"),
    ("autonomous",       "자율"),
    ("club",             "동아리"),
    ("volunteer",        "봉사"),
    ("career",           "진로"),
    ("behavior",         "행특"),
    ("reading",          "독서"),
    ("award",            "수상"),
]


def _doc_pct(content: str) -> int:
    chars = len((content or "").strip())
    if chars == 0:
        return 0
    return min(100, chars * 100 // 800)


def _ago_str(dt: datetime) -> str:
    ms = (datetime.now(timezone.utc) - dt).total_seconds() * 1000
    if ms < 3_600_000:
        return f"{max(1, int(ms // 60_000))}분 전"
    if ms < 86_400_000:
        return f"{int(ms // 3_600_000)}시간 전"
    return "어제"


@stats_router.get("", response_model=StatsOut)
async def get_stats(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> StatsOut:
    snap = await get_graph_store().get_snapshot(user.id)
    node_count = len(snap.nodes)
    edge_count = len(snap.edges)
    top_nodes = [{"label": n.label, "count": 1} for n in snap.nodes[:8]]

    comment_count = form_count = voice_count = voice_duration = 0
    sections: list[dict] = []
    recent_activities: list[dict] = []

    if is_offline_demo():
        db = get_memory_db()
        comments_list = [c for c in getattr(db, "comments", {}).values() if c["user_id"] == user.id]
        forms_list    = [f for f in getattr(db, "forms",    {}).values() if f["user_id"] == user.id]
        voices_list   = [v for v in getattr(db, "voice",    {}).values() if v["user_id"] == user.id]
        docs_by_type  = {}
        for d in db.documents.values():
            if d.user_id == user.id:
                docs_by_type.setdefault(d.section_type, []).append(d)

        comment_count = len(comments_list)
        form_count    = len(forms_list)
        voice_count   = len(voices_list)
        voice_duration = sum(int(v.get("duration_sec", 0)) for v in voices_list)

        for stype, name in _SECTION_META:
            docs = docs_by_type.get(stype, [])
            best = max((len((d.content or "").strip()) for d in docs), default=0)
            sections.append({"name": name, "pct": _doc_pct(" " * best)})

        # 최근 활동 피드 구성
        events: list[tuple[datetime, str, str]] = []
        for c in comments_list:
            events.append((c["created_at"], "코멘트 수신", f"{c['author']}님이 코멘트를 남겼습니다"))
        for f in forms_list:
            events.append((f["created_at"], "양식 생성", f['title']))
        for v in voices_list:
            events.append((v["created_at"], "음성 녹음", v["title"]))
        events.sort(key=lambda x: x[0], reverse=True)
        recent_activities = [
            {"type": t, "detail": d, "time": _ago_str(ts)}
            for ts, t, d in events[:8]
        ]
    else:
        assert session is not None
        comments_rows = (await session.execute(
            select(CommentRow).where(CommentRow.user_id == user.id).order_by(CommentRow.created_at.desc())
        )).scalars().all()
        forms_rows = (await session.execute(
            select(FormDocRow).where(FormDocRow.user_id == user.id).order_by(FormDocRow.created_at.desc())
        )).scalars().all()
        voices_rows = (await session.execute(
            select(VoiceSessionRow).where(VoiceSessionRow.user_id == user.id)
        )).scalars().all()

        from app.db.postgres import DocumentSectionRow  # noqa: PLC0415
        docs_rows = (await session.execute(
            select(DocumentSectionRow).where(DocumentSectionRow.user_id == user.id)
        )).scalars().all()
        docs_by_type: dict[str, list] = {}
        for d in docs_rows:
            docs_by_type.setdefault(d.section_type, []).append(d)

        comment_count  = len(comments_rows)
        form_count     = len(forms_rows)
        voice_count    = len(voices_rows)
        voice_duration = sum(v.duration_sec for v in voices_rows)

        for stype, name in _SECTION_META:
            docs = docs_by_type.get(stype, [])
            best = max((len((d.content or "").strip()) for d in docs), default=0)
            sections.append({"name": name, "pct": _doc_pct(" " * best)})

        events = []
        for c in comments_rows[:4]:
            events.append((c.created_at, "코멘트 수신", f"{c.author}님이 코멘트를 남겼습니다"))
        for f in forms_rows[:2]:
            events.append((f.created_at, "양식 생성", f.title))
        for v in voices_rows[:2]:
            events.append((v.created_at, "음성 녹음", v.title))
        events.sort(key=lambda x: x[0], reverse=True)
        recent_activities = [
            {"type": t, "detail": d, "time": _ago_str(ts)}
            for ts, t, d in events[:8]
        ]

    return StatsOut(
        node_count=node_count,
        edge_count=edge_count,
        comment_count=comment_count,
        form_count=form_count,
        voice_count=voice_count,
        voice_duration_sec=voice_duration,
        sections=sections,
        top_nodes=top_nodes,
        recent_activities=recent_activities,
    )
