/**
 * S21 — 내 보고서
 *
 * 목록 줄이 카드 하나 안에 실선으로 갈려 있었다. 탐구 피드는 글 하나가
 * 카드 하나다 — 같은 "목록" 인데 한쪽은 표, 한쪽은 카드라 다른 앱처럼 읽혔다.
 * 여기도 한 줄에 한 카드로 맞춘다.
 */

import { useState, useEffect } from "react";
import { Btn } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { FormTabs } from "../../components/forms/FormTabs.jsx";
import { useLoading } from "../../components/LoadingDock.jsx";
import api from "../../api/index.js";

const TEMPLATE_LABEL = {
  upload: "올린 양식을 채움",
  setuk: "세특 요약 보고서",
  club: "동아리 활동 보고서",
  career: "진로 포트폴리오",
  reading: "독서 감상문",
  service: "봉사활동 에세이",
};

export function S21({ onNav }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.forms.list()
      .then((data) => setItems(data || []))
      .catch((e) => { setErr(e.message); setItems([]); });
  }, []);

  useLoading(items === null && !err, "보고서 목록을 불러오는 중이에요…");

  const open = (id) => {
    sessionStorage.setItem("mbx_form_id", id);
    onNav("S22");
  };

  return (
    <div className="rs-wrap">
      <FormTabs active="S21" onNav={onNav} />
      {err && <div className="form-err">{err}</div>}

      {items && !items.length && (
        <div className="empty">
          <div className="empty-title">아직 쓴 보고서가 없습니다</div>
          <div className="empty-sub">생기부에 적힌 내용을 근거로 대신 써 드립니다.</div>
          <Btn v="primary" s="md" onClick={() => onNav("S20")}>보고서 쓰기</Btn>
        </div>
      )}

      {!!items?.length && (
        <div className="rs-list">
          {items.map((it) => (
            <button key={it.id} type="button" className="rs-article form-row" onClick={() => open(it.id)}>
              <span className="form-row-ic"><NavIcon name="form" size={18} color="var(--primary)" /></span>
              <span className="form-row-body">
                <span className="rs-article-title">{it.title}</span>
                <span className="rs-article-meta">
                  {TEMPLATE_LABEL[it.template_id] || it.template_id}
                  <span aria-hidden>·</span>
                  {(it.created_at || "").slice(0, 10)}
                </span>
              </span>
              <NavIcon name="chevronRight" size={16} color="var(--tt)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
