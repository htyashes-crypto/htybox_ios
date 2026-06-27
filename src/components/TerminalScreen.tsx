import { useRef } from "react";
import type { HostConnection } from "../conn/connection";
import { MobileTerminal, type MobileTerminalHandle } from "../terminal/MobileTerminal";

// 输入辅助条：补软键盘缺失的终端控制键（Esc/Tab/常用 Ctrl 组合/方向键）。
const KEYS: { label: string; seq: string }[] = [
  { label: "Esc", seq: "\x1b" },
  { label: "Tab", seq: "\x09" },
  { label: "^C", seq: "\x03" },
  { label: "^D", seq: "\x04" },
  { label: "^Z", seq: "\x1a" },
  { label: "^L", seq: "\x0c" },
  { label: "↑", seq: "\x1b[A" },
  { label: "↓", seq: "\x1b[B" },
  { label: "←", seq: "\x1b[D" },
  { label: "→", seq: "\x1b[C" },
];

interface Props {
  conn: HostConnection;
  terminalId: string;
  onBack(): void;
}

export function TerminalScreen({ conn, terminalId, onBack }: Props) {
  const termRef = useRef<MobileTerminalHandle>(null);
  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center gap-2 px-2 py-2"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <button onClick={onBack} className="rounded px-2 py-1 text-sm" style={{ color: "var(--accent)" }}>
          ‹ 返回
        </button>
        <div className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--text-dim)" }}>
          {conn.serverInfo?.hostName} · {terminalId}
        </div>
      </div>

      <div className="min-h-0 flex-1" onClick={() => termRef.current?.focus()}>
        <MobileTerminal ref={termRef} conn={conn} terminalId={terminalId} />
      </div>

      <div
        className="flex gap-1 overflow-x-auto px-2 py-2"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        {KEYS.map((k) => (
          <button
            key={k.label}
            onClick={() => termRef.current?.sendKey(k.seq)}
            className="shrink-0 rounded px-3 py-1.5 font-mono text-xs"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
