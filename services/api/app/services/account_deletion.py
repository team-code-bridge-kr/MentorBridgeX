"""계정을 통째로 지운다.

여태 삭제 화면은 **아무것도 부르지 않았다.** 단추를 누르면 "삭제 요청이
접수되었습니다 · 2026-02-20 이후 데이터가 완전히 삭제됩니다" 가 떴는데, 그
날짜는 화면에 박아 둔 글자였고 서버는 요청이 있었다는 사실조차 몰랐다.
개인정보를 지워 달라는 것은 학생의 권리인데, 지워 준 척만 하고 있었다.

여기서 정하는 것 둘.

1. **미루지 않고 바로 지운다.** 30일 유예를 두려면 "지우는 중" 상태와 그날
   실제로 지우는 일꾼이 필요하다. 그 일꾼이 한 번 죽으면 아무도 모르는 채
   데이터가 남는다 — 지워 준 척했던 것과 같은 자리로 돌아간다.
2. **한 곳에서 다 지운다.** 표가 열여덟이라 화면마다 지우면 반드시 빠뜨린다.
   목록을 여기 한 줄로 세워 두고, `user_id` 칸이 있는 표가 새로 생기면
   여기 테스트가 먼저 깨지게 한다.

지우지 않는 것: `articles`·`tracks` 같은 공용 수집 데이터. 개인의 것이 아니다.
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import get_graph_store

logger = logging.getLogger(__name__)

# `user_id` 칸으로 사람과 이어지는 표 전부. 지우는 차례가 중요하다 —
# users 는 다른 표가 가리키고 있으므로 맨 끝이다.
USER_TABLES: tuple[str, ...] = (
    "assistant_conversations",
    "activity_meta",
    "article_feedback",
    "user_reads",
    "user_keywords",
    "user_majors",
    "research_profiles",
    "comments",
    "notifications",
    "form_documents",
    "voice_sessions",
    "document_sections",
    "document_files",
    "jobs",
    "user_settings",
    "classroom_members",
    "mentor_profiles",
    "user_profiles",
)


async def delete_account(session: AsyncSession, user_id: str) -> dict[str, int]:
    """이 사람에 딸린 모든 것을 지운다. 지운 줄 수를 표별로 돌려준다.

    돌려주는 값은 로그와 테스트용이다 — "지웠다" 는 말만으로는 정말 지워졌는지
    아무도 확인할 수 없다.
    """
    removed: dict[str, int] = {}

    # 메시지는 `user_id` 가 없고 대화를 가리킨다. 대화보다 먼저 지워야 한다 —
    # 대화가 먼저 사라지면 어느 메시지가 이 사람 것이었는지 알 수 없게 된다.
    # 그래서 위 목록에 넣을 수 없고 여기서 따로 지운다.
    msg = await session.execute(
        text(
            "DELETE FROM assistant_messages WHERE conversation_id IN "
            "(SELECT id FROM assistant_conversations WHERE user_id = :uid)"
        ),
        {"uid": user_id},
    )
    removed["assistant_messages"] = msg.rowcount or 0

    # 멘토링도 같은 사정이다. 메시지는 `link_id` 를 가리키고, 링크는 `user_id`
    # 가 아니라 `mentor_id`/`student_id` 를 가진다 — 둘 다 위 목록에 못 넣는다.
    #
    # **주고받은 말은 두 사람의 것이지만 지운다.** 한쪽이 계정을 지웠는데
    # 그 사람이 한 말이 상대 화면에 그대로 남아 있으면, 지웠다는 말이 거짓이
    # 된다. 상대에게는 대화가 통째로 사라지는 편이 낫다.
    mm = await session.execute(
        text(
            "DELETE FROM mentor_messages WHERE link_id IN "
            "(SELECT id FROM mentor_links WHERE mentor_id = :uid OR student_id = :uid)"
        ),
        {"uid": user_id},
    )
    removed["mentor_messages"] = mm.rowcount or 0
    ml = await session.execute(
        text("DELETE FROM mentor_links WHERE mentor_id = :uid OR student_id = :uid"),
        {"uid": user_id},
    )
    removed["mentor_links"] = ml.rowcount or 0
    mi = await session.execute(
        text("DELETE FROM mentor_invites WHERE mentor_id = :uid OR used_by = :uid"),
        {"uid": user_id},
    )
    removed["mentor_invites"] = mi.rowcount or 0

    for table in USER_TABLES:
        result = await session.execute(
            text(f"DELETE FROM {table} WHERE user_id = :uid"),  # noqa: S608 — 상수 목록
            {"uid": user_id},
        )
        removed[table] = result.rowcount or 0

    # 교사가 만든 학급은 학생들이 딸려 있다. 학급을 통째로 지우면 남의 기록까지
    # 사라지므로, 주인만 떼어 놓고 학급은 남긴다.
    orphan = await session.execute(
        text("UPDATE classrooms SET teacher_id = NULL WHERE teacher_id = :uid"), {"uid": user_id}
    )
    removed["classrooms_orphaned"] = orphan.rowcount or 0

    user = await session.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user_id})
    removed["users"] = user.rowcount or 0

    await session.commit()

    # 그래프는 다른 데이터베이스라 같은 트랜잭션에 묶이지 않는다. 뒤에 두는
    # 이유: 여기서 실패해도 사람은 이미 지워져 다시 로그인할 수 없다. 순서를
    # 바꾸면 그래프만 사라지고 계정이 남는, 더 나쁜 어긋남이 생긴다.
    try:
        removed["graph_nodes"] = await get_graph_store().delete_all_for_user(user_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("계정 삭제: 그래프를 지우지 못함 user=%s: %s", user_id, exc)
        removed["graph_nodes"] = -1

    # 로그에 이메일·이름을 남기지 않는다. 지우려고 부른 함수가 식별 정보를
    # 로그에 새로 적으면 안 된다.
    logger.info("계정 삭제 user=%s 지운 줄=%s", user_id, sum(v for v in removed.values() if v > 0))
    return removed


async def list_user_tables(session: AsyncSession) -> set[str]:
    """지금 데이터베이스에서 `user_id` 칸을 가진 표. 테스트가 쓴다."""
    result = await session.execute(
        select(text("table_name")).select_from(text("information_schema.columns")).where(
            text("column_name = 'user_id' AND table_schema = 'public'")
        )
    )
    return {row[0] for row in result.all()}
