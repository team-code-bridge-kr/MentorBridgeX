"""비밀번호 해시.

**새 의존성을 들이지 않는다.** bcrypt·argon2 를 쓰려면 패키지를 하나 더
얹어야 하는데, 파이썬 표준 라이브러리의 `hashlib.scrypt` 가 이 용도에는
충분하다 — 메모리를 많이 쓰도록 설계된 함수라 GPU 로 몰아치기 어렵다.

저장 형태는 한 줄 문자열이다. 값만 보고도 어떤 방법으로 몇 번 돌렸는지 알 수
있어야, 나중에 세기를 올릴 때 **옛 해시를 그대로 두고** 로그인할 때 조용히
다시 계산해 줄 수 있다.

    scrypt$16384$8$1$<소금 base64>$<해시 base64>

`verify()` 는 실패할 때 **왜 틀렸는지 말하지 않는다.** 비밀번호가 틀린 것과
계정에 비밀번호가 없는 것을 구별해 주면, 그 차이만으로 어떤 이메일이 가입돼
있는지 알아낼 수 있다.
"""

from __future__ import annotations

import base64
import hmac
import os
from hashlib import scrypt

# 2^14 = 16384. 노트북에서 한 번에 ~50ms — 로그인 한 번에 사람이 못 느끼는
# 시간이면서, 무작위 대입에는 충분히 비싸다.
_N = 16384
_R = 8
_P = 1
_DKLEN = 32
_SALT_BYTES = 16

MIN_LENGTH = 8


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def hash_password(password: str) -> str:
    """비밀번호 하나를 저장할 수 있는 한 줄로."""
    salt = os.urandom(_SALT_BYTES)
    dk = scrypt(password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str | None) -> bool:
    """맞으면 True. **어떤 이유로든 아니면 조용히 False.**

    비밀번호가 없는 계정(구글로 만든 계정)도 여기서 False 가 된다 — 호출하는
    쪽에서 "비밀번호가 없다" 를 따로 알리지 말 것. 그 차이가 곧 가입 여부를
    알려 주는 신호가 된다.
    """
    if not stored or not password:
        return False
    try:
        scheme, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        dk = scrypt(
            password.encode("utf-8"),
            salt=base64.b64decode(salt_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(base64.b64decode(hash_b64)),
        )
    except (ValueError, TypeError):
        return False
    # 길이·내용이 새는 것을 막으려면 상수 시간 비교여야 한다.
    return hmac.compare_digest(dk, base64.b64decode(hash_b64))


def check_strength(password: str) -> str | None:
    """약하면 **사람이 읽을 이유**를, 괜찮으면 None.

    규칙을 길게 두지 않는다. 대문자·특수문자를 강제하면 사람들은
    `Password1!` 같은 것을 쓰고, 그건 길이 12짜리 아무 문장보다 약하다.
    """
    if len(password) < MIN_LENGTH:
        return f"비밀번호는 {MIN_LENGTH}자 이상이어야 합니다."
    if password.isdigit():
        return "숫자만으로는 만들 수 없습니다."
    return None
