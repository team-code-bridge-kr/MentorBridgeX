/**
 * 설정 화면의 학급 카드.
 *
 * 학생에게 참여 코드를 **온보딩 중에는 묻지 않는다.** 가입한 날 코드를 들고 있는
 * 학생은 드물고, 거기서 막히면 온보딩 자체가 끝나지 않는다. 대신 나중에 받았을 때
 * 넣을 자리를 여기 둔다.
 */

import { useEffect, useState } from "react";
import api from "../../api/index.js";

export function ClassroomJoinCard() {
  const [rooms, setRooms] = useState([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.classrooms
      .mine()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  const join = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const room = await api.classrooms.join(code.trim());
      setRooms((r) => (r.some((x) => x.id === room.id) ? r : [...r, room]));
      setCode("");
      setMsg(`'${room.name}' 학급에 연결했습니다.`);
    } catch (e) {
      setErr(e.message || "참여하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-p">
      <div className="ob-set-title">학급</div>
      {rooms.length > 0 ? (
        <ul className="ob-class-list">
          {rooms.map((r) => (
            <li key={r.id} className="ob-class">
              <div>
                <span className="ob-class-name">{r.name}</span>
                {r.school && <span className="ob-class-school">{r.school}</span>}
              </div>
              {/* 내가 만든 학급일 때만 코드를 보여준다 — 남의 학급 코드를
                  퍼뜨릴 수 있는 자리를 만들지 않는다 */}
              {r.owned && <span className="ob-class-code">{r.join_code}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ob-hint">아직 연결된 학급이 없습니다. 선생님께 받은 코드를 넣어 보세요.</p>
      )}

      <div className="ob-class-form" style={{ marginTop: 12 }}>
        <input
          className="inp ob-code-inp"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="참여 코드 6자리"
          maxLength={8}
          disabled={busy}
          aria-label="학급 참여 코드"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={join}
          disabled={busy || code.trim().length < 4}
        >
          참여
        </button>
      </div>
      {msg && <p className="ob-hint">{msg}</p>}
      {err && (
        <p className="ob-warn" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
