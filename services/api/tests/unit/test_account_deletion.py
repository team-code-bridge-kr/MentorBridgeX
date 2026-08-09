"""계정 삭제가 표를 빠뜨리지 않는지.

이 목록이 실제 스키마보다 뒤처지면 **지웠다고 말하면서 남기게 된다.** 지워
달라는 요청에 대해 그건 그냥 거짓말이라, 표가 새로 생기면 여기가 먼저
깨져야 한다.

DB 없이 도는 테스트다 — 목록과 코드의 어긋남만 본다. 실제로 다 지워지는지는
docker 를 띄우고 확인한다(tests/test_pruning.py 처럼 integration 표시).
"""

import re
from pathlib import Path

from app.services.account_deletion import USER_TABLES

APP = Path(__file__).resolve().parents[2] / "app"


def _declared_tables() -> dict[str, str]:
    """모델 파일에서 (표 이름 → 파일) 를 모은다. `user_id` 칸이 있는 것만."""
    found: dict[str, str] = {}
    for path in APP.rglob("*.py"):
        src = path.read_text(encoding="utf-8")
        # 클래스 단위로 잘라 본다 — 한 파일에 표가 여럿이다
        for block in re.split(r"\nclass ", src):
            m = re.search(r'__tablename__\s*=\s*"([a-z_]+)"', block)
            if not m:
                continue
            if re.search(r"\buser_id\b\s*:\s*Mapped", block):
                found[m.group(1)] = path.name
    return found


def test_user_id_를_가진_표는_모두_지운다():
    declared = _declared_tables()
    # users 는 사람 자신이라 마지막에 따로 지운다.
    expected = set(declared) - {"users"}
    listed = set(USER_TABLES)

    missing = expected - listed
    assert not missing, (
        f"계정 삭제에서 빠진 표: {sorted(missing)}. "
        "app/services/account_deletion.py 의 USER_TABLES 에 넣어 주세요."
    )


def test_없는_표를_지우려_하지_않는다():
    # 표를 지웠는데 목록에 남아 있으면 삭제가 통째로 실패한다 — 지우려던
    # 사람은 아무것도 못 지운다.
    declared = set(_declared_tables())
    stale = set(USER_TABLES) - declared
    assert not stale, f"이제 없는 표: {sorted(stale)}"


def test_지우는_차례에_users_가_없다():
    # users 를 목록 안에서 지우면 다른 표보다 먼저 사라질 수 있다.
    assert "users" not in USER_TABLES


def test_같은_표를_두_번_적지_않았다():
    assert len(USER_TABLES) == len(set(USER_TABLES))
