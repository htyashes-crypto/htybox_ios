import { useEffect, useState } from "react";
import type { TerminalInfo } from "@htybox/link";
import type { HostConnection } from "../conn/connection";

interface Props {
  conn: HostConnection;
  onOpen(terminalId: string): void;
  onBack(): void;
}

export function TerminalList({ conn, onOpen, onBack }: Props) {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setErr("");
    try {
      const r = await conn.listTerminals();
      setTerminals(r.terminals);
    } catch (e) {
      setErr(String(e));
    }
  }
  useEffect(() => {
    void reload();
    // eslint 无；conn 在本屏生命周期内稳定
  }, []);

  async function create() {
    setBusy(true);
    setErr("");
    try {
      onOpen(await conn.createTerminal(80, 24));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
      <div className="flex items-center gap-2 px-4 py-2">
        <button onClick={onBack} className="text-sm" style={{ color: "var(--accent)" }}>
          ‹ Host
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
          {conn.serverInfo?.hostName} 的终端
        </div>
        <button onClick={() => void reload()} className="text-xs" style={{ color: "var(--text-dim)" }}>
          刷新
        </button>
      </div>
      {err && (
        <div className="mx-4 mb-2 text-xs" style={{ color: "#e06c5b" }}>
          {err}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {terminals.length === 0 ? (
          <div className="mt-12 text-center text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Host 上暂无终端。
            <br />
            点下方「新建终端」。
          </div>
        ) : (
          terminals.map((t) => (
            <button
              key={t.terminalId}
              onClick={() => onOpen(t.terminalId)}
              className="mb-2 block w-full rounded-lg p-3 text-left"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                {t.title || t.terminalId}
              </div>
              <div className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
                {t.cwd || "—"} · {t.cols}×{t.rows}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
        <button
          onClick={() => void create()}
          disabled={busy}
          className="w-full rounded px-4 py-2.5 text-sm font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {busy ? "新建中…" : "+ 新建终端"}
        </button>
      </div>
    </div>
  );
}
