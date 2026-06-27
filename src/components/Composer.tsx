import { useEffect, useRef, useState } from "react";

interface Props {
  agentLabel: string; // 目标终端/agent 名（如 "Claude Code" / "PowerShell"）
  onSend(text: string): void;
}

// 富输入框（Claude 风格）：发送到活动终端。＋=附件/图片（开发中），🎤=语音（未来）。
// 注入靠 @、命令靠 /（直接在文本里输入，由终端内 agent 解析）。
export function Composer({ agentLabel, onSend }: Props) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);

  function flash(msg: string) {
    setNote(msg);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(""), 2500);
  }

  function send() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  const canSend = text.trim().length > 0;

  return (
    <div className="px-3 pt-2" style={{ paddingBottom: "0.4rem" }}>
      {note && (
        <div className="mb-1 px-2 text-xs" style={{ color: "var(--text-dim)" }}>
          {note}
        </div>
      )}
      <div className="rounded-2xl p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="发消息，@files，/commands"
          className="max-h-28 w-full resize-none bg-transparent px-2 pb-1 pt-1 text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
        <div className="flex items-center gap-3 px-1 pt-1">
          {/* ＋ 附件/图片（开发中）*/}
          <button onClick={() => flash("附件/图片：开发中")} aria-label="附件" className="shrink-0" style={{ color: "var(--text-dim)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="12" y1="6" x2="12" y2="18" />
              <line x1="6" y1="12" x2="18" y2="12" />
            </svg>
          </button>
          {/* 目标 agent 芯片 */}
          <div className="flex min-w-0 items-center gap-1">
            <span style={{ color: "var(--accent)" }}>✻</span>
            <span className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>
              {agentLabel}
            </span>
          </div>
          <div className="flex-1" />
          {/* 🎤 语音（未来）*/}
          <button onClick={() => flash("语音输入：未来支持")} aria-label="语音" className="shrink-0" style={{ color: "var(--text-dim)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
          </button>
          {/* ↑ 发送 */}
          <button
            onClick={send}
            disabled={!canSend}
            aria-label="发送"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ background: canSend ? "var(--accent)" : "var(--surface-2)", color: canSend ? "#fff" : "var(--text-dim)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="6 11 12 5 18 11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
