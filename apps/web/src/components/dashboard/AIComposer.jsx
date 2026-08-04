/**
 * AI 입력창.
 *
 * 한 줄 input 이 아니라 여러 줄까지 자라는 textarea. Enter 전송 / Shift+Enter 줄바꿈.
 * 첨부(파일)와 음성은 입력창 안쪽 왼쪽, 전송은 오른쪽에 둔다.
 *
 * 마이크는 화면 이동이 아니라 **여기서 바로 받아쓰기**를 한다 (useDictation).
 * 질문 한 줄 말하려고 음성 화면까지 갔다 오게 만들면 아무도 쓰지 않는다.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AIContextChipList } from "./AIContextChip.jsx";
import { ComposerHint } from "./ComposerHint.jsx";
import { NavIcon } from "../NavIcon.jsx";
import { useDictation } from "../../hooks/useDictation.js";

// 입력 영역을 넉넉히 — 링크 + 질문을 함께 붙여넣는 경우가 많다
const MAX_ROWS = 7;
const LINE_HEIGHT = 26;
const PLACEHOLDER = "질문하거나 기사·논문·영상 링크를 입력하세요";

export function AIComposer({
  value,
  onChange,
  onSubmit,
  context,
  onRemoveContext,
  streaming,
  onStop,
  autoFocus,
  compact,
  actions,
  onPickAction,
}) {
  const areaRef = useRef(null);
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const hintId = useId();

  /**
   * 안내문 자리에서 빠른 실행을 돌린다. 쓴 글자가 있으면 내린다 —
   * 쓰고 있는 문장 위에 다른 글자가 겹치면 안 된다.
   */
  const showHint = !value && actions?.length > 0 && !!onPickAction;

  /**
   * 화면을 열자마자 커서를 여기 둔다. 단, **폰에서는 두지 않는다** — 들어오자마자
   * 자판이 올라와 화면 절반을 가린다.
   *
   * 브라우저 기본 autoFocus 속성 대신 직접 부르는 이유는 preventScroll 때문이다.
   * 기본 동작은 입력창을 보이게 하려고 조상 스크롤을 전부 움직이는데, 그 바람에
   * 위쪽 카드 가로 스크롤이 14px 밀려서 첫 카드가 화면 끝에 붙어 보였다.
   */
  useEffect(() => {
    if (!autoFocus) return;
    if (!window.matchMedia("(min-width: 769px)").matches) return;
    areaRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

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

  // 받아쓰기 결과는 지우지 않고 뒤에 붙인다 — 쓰던 문장을 날리면 안 된다
  const appendText = useCallback(
    (text) => {
      if (!text) return;
      onChange(value ? `${value.trimEnd()} ${text}` : text);
      areaRef.current?.focus();
    },
    [onChange, value]
  );
  const mic = useDictation({ onText: appendText });
  const recording = mic.state === "recording";
  const sending = mic.state === "sending";

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

      <div className="composer-field">
        <textarea
          ref={areaRef}
          className="composer-input"
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          // 안내문을 겹쳐 그리는 동안에는 기본 placeholder 를 비운다 — 두 벌이 겹친다
          placeholder={showHint ? "" : PLACEHOLDER}
          aria-label="MBX AI에게 질문하기"
          aria-describedby={showHint ? hintId : undefined}
        />
        {showHint && (
          <ComposerHint
            placeholder={PLACEHOLDER}
            actions={actions}
            onPick={onPickAction}
            baseId={hintId}
          />
        )}
      </div>

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
          <button
            type="button"
            className={`composer-tool${recording ? " is-recording" : ""}`}
            aria-label={recording ? "녹음 중지" : "음성으로 입력"}
            aria-pressed={recording}
            title={recording ? "녹음 중지" : "음성으로 입력"}
            disabled={sending}
            onClick={mic.toggle}
          >
            <NavIcon name={recording ? "dot" : "voice"} size={17} color="currentColor" />
          </button>
          {(recording || sending) && (
            <span className="composer-mic-state" role="status">
              {recording ? "듣고 있어요… 다시 눌러 끝내기" : "받아쓰는 중…"}
            </span>
          )}
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

      {mic.error && (
        <p className="composer-mic-error" role="alert">
          {mic.error}
          <button type="button" className="btn-inline" onClick={mic.clearError}>닫기</button>
        </p>
      )}
    </div>
  );
}
