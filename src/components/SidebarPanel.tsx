import { useEffect, useState } from "react";
import type { DirEntry, MemoryItem, SessionRef, Skill } from "@htybox/link";
import type { HostConnection } from "../conn/connection";

type Tab = "skill" | "memory" | "file" | "session";
const TABS: { key: Tab; label: string }[] = [
  { key: "skill", label: "Skill" },
  { key: "memory", label: "Memory" },
  { key: "file", label: "File" },
  { key: "session", label: "Session" },
];

interface Props {
  open: boolean;
  conn: HostConnection;
  activeWs: { id: string; name: string; path: string } | null;
}

function parentDir(p: string): string {
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i > 0 ? p.slice(0, i) : p;
}

// 左侧 Content（镜像桌面 Sidebar）：左右滑动动画 + 按当前工作区作用域拉取只读数据（4P-2）。
export function SidebarPanel({ open, conn, activeWs }: Props) {
  const [tab, setTab] = useState<Tab>("skill");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [fileDir, setFileDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [sessions, setSessions] = useState<{ claude: SessionRef[]; codex: SessionRef[] }>({ claude: [], codex: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setFileDir(null), [activeWs]);

  useEffect(() => {
    if (!open || !activeWs) return;
    let cancelled = false;
    setErr("");
    setLoading(true);
    const fail = (e: unknown) => !cancelled && setErr(String(e));
    const done = () => !cancelled && setLoading(false);
    if (tab === "skill") {
      conn.listSkills(activeWs.path).then((r) => !cancelled && setSkills(r.skills)).catch(fail).finally(done);
    } else if (tab === "memory") {
      conn.listMemories(activeWs.id).then((r) => !cancelled && setMemories(r.memories)).catch(fail).finally(done);
    } else if (tab === "file") {
      conn.listFiles(fileDir ?? activeWs.path).then((r) => !cancelled && setEntries(r.entries)).catch(fail).finally(done);
    } else {
      conn.listSessions(activeWs.path).then((r) => !cancelled && setSessions(r)).catch(fail).finally(done);
    }
    return () => {
      cancelled = true;
    };
  }, [open, tab, activeWs, fileDir, conn]);

  const atRoot = !fileDir || (activeWs != null && fileDir === activeWs.path);

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{
        background: "var(--bg)",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div className="flex gap-4 px-4" style={{ height: 40, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="relative text-sm" style={{ color: on ? "var(--text)" : "var(--text-dim)", fontWeight: on ? 700 : 400 }}>
              {t.label}
              {on && <span className="absolute inset-x-0 -bottom-px h-0.5" style={{ background: "var(--accent)" }} />}
            </button>
          );
        })}
      </div>

      {!activeWs ? (
        <div className="grid flex-1 place-items-center px-6 text-center text-sm" style={{ color: "var(--text-dim)" }}>
          选择一个工作区以查看其内容
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {err && <div className="mb-2 text-xs" style={{ color: "#e06c5b" }}>{err}</div>}
          {loading && <div className="mb-2 text-xs" style={{ color: "var(--text-dim)" }}>加载中…</div>}

          {tab === "skill" && skills.map((s) => <Card key={s.path} title={s.name} sub={s.description} badge={s.source} />)}
          {tab === "skill" && !loading && skills.length === 0 && <Empty text="无 skill" />}

          {tab === "memory" && memories.map((m) => <Card key={m.path} title={m.name} sub={m.description} badge={m.memType} />)}
          {tab === "memory" && !loading && memories.length === 0 && <Empty text="无 memory" />}

          {tab === "file" && (
            <>
              {!atRoot && (
                <button onClick={() => setFileDir(activeWs && parentDir(fileDir!).length < activeWs.path.length ? null : parentDir(fileDir!))} className="mb-1 block w-full rounded px-3 py-2 text-left text-sm" style={{ color: "var(--accent)" }}>
                  ‹ 上级
                </button>
              )}
              {entries.map((e) => (
                <button
                  key={e.path}
                  onClick={() => e.isDir && setFileDir(e.path)}
                  className="block w-full rounded px-3 py-2 text-left text-sm"
                  style={{ color: "var(--text)" }}
                >
                  {e.isDir ? "📁 " : "📄 "}
                  {e.name}
                </button>
              ))}
              {!loading && entries.length === 0 && <Empty text="空目录" />}
            </>
          )}

          {tab === "session" && (
            <>
              <SecTitle text={`Claude（${sessions.claude.length}）`} />
              {sessions.claude.map((s) => <Card key={s.id} title={s.label} sub={fmtTs(s.ts)} badge="claude" />)}
              <SecTitle text={`Codex（${sessions.codex.length}）`} />
              {sessions.codex.map((s) => <Card key={s.id || s.path} title={s.label} sub={fmtTs(s.ts)} badge="codex" />)}
              {!loading && sessions.claude.length === 0 && sessions.codex.length === 0 && <Empty text="无会话" />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, sub, badge }: { title: string; sub?: string; badge?: string }) {
  return (
    <div className="mb-2 rounded-lg p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--text)" }}>{title}</span>
        {badge && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>{badge}</span>}
      </div>
      {sub && <div className="mt-1 truncate text-xs" style={{ color: "var(--text-dim)" }}>{sub}</div>}
    </div>
  );
}
function SecTitle({ text }: { text: string }) {
  return <div className="mb-1 mt-2 text-xs font-semibold" style={{ color: "var(--text-dim)" }}>{text}</div>;
}
function Empty({ text }: { text: string }) {
  return <div className="mt-8 text-center text-sm" style={{ color: "var(--text-dim)" }}>{text}</div>;
}
function fmtTs(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}
