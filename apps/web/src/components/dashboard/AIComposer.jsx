/**
 * AI 입력창.
 *
 * 한 줄 input 이 아니라 3~4줄까지 자라는 textarea. Enter 전송 / Shift+Enter 줄바꿈.
 * 첨부(파일)와 음성은 입력창 안쪽 왼쪽, 전송은 오른쪽에 둔다.
 */

import { useEffect, useRef, useState } from "react";
import { AIContextChipList } from "./AIContextChip.jsx";
import { NavIcon } from "../NavIcon.jsx";

const MAX_ROWS = 4;
const LINE_HEIGHT = 24;

export function AIComposer({
  value,
  onChange,
  onSubmit,
  context,
  onRemoveContext,
  onVoice,
  streaming,
  onStop,
  autoFocus,
  compact,
}) {
  const areaRef = useRef(null);
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);

  // 내용에 맞춰 높이를 늘리되 4줄에서 멈추고 그 다음부터 스크롤
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = LINE_HEIGHT * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  const canSend = value.trim().length > 0 && !streaming;

  const submit = () => {
    if (!canSend) return;
    onSubmit(value.trim(), files);
    setFiles([]);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const pickFiles = (e) => {
    const picked = [...(e.target.files || [])].slice(0, 3);
    setFiles((prev) => [...prev, ...picked].slice(0, 3));
    e.target.value = "";
  };

  return (
    <div className={`composer${compact ? " composer-compact" : ""}`}>
      {(context?.length > 0 || files.length > 0) && (
        <div className="composer-attach">
          <AIContextChipList items={context} onRemove={onRemoveContext} />
          {files.map((f) => (
            <span key={f.name} className="ctx-chip ctx-file">
              <span aria-hidden="true" className="ctx-chip-ic">📎</span>
              <span className="ctx-chip-label">{f.name}</span>
              <button
                type="button"
                className="ctx-chip-x"
                aria-label={`${f.name} 첨부 제거`}
                onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={areaRef}
        className="composer-input"
        rows={1}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="질문하거나 기사·논문·영상 링크를 입력하세요"
        aria-label="MBX AI에게 질문하기"
      />

      <div className="composer-bar">
        <div className="composer-tools">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={pickFiles}
            aria-hidden="true"
            tabIndex={-1}
          />
          {/* 앱 전체가 같은 선 스타일의 SVG 아이콘을 쓰므로 여기도 맞춘다.
              링크는 입력창에 그대로 붙여넣으면 되므로 별도 버튼(브라우저 prompt)을
              두지 않는다 — 첨부와 음성 둘만 남긴다. */}
          <button type="button" className="composer-tool" aria-label="파일 첨부"
            title="파일 첨부" onClick={() => fileRef.current?.click()}>
            <NavIcon name="paperclip" size={17} color="currentColor" />
          </button>
          <button type="button" className="composer-tool" aria-label="음성 입력"
            title="음성 입력 (음성 화면으로 이동)" onClick={() => onVoice?.()}>
            <NavIcon name="voice" size={17} color="currentColor" />
          </button>
        </div>

        {streaming ? (
          <button type="button" className="composer-send is-stop" onClick={onStop}
            aria-label="답변 생성 중지">■</button>
        ) : (
          <button
            type="button"
            className="composer-send"
            onClick={submit}
            disabled={!canSend}
            aria-label="전송"
            aria-disabled={!canSend}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
}
