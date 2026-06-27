// 连上 Host 后的镜像主屏（外壳）：工具栏(侧栏开关滑动 + 工作区▾ + ＋终端▾) +
// 终端 Tab 条 + 活动终端 + 左滑 Content + 控制键条 + 富输入框 + 底部状态/断开。
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { WorkspaceInfo } from "@htybox/link";
import type { HostConnection } from "../conn/connection";
import { MobileTerminal, type MobileTerminalHandle } from "../terminal/MobileTerminal";
import { Composer } from "./Composer";
import { SidebarPanel } from "./SidebarPanel";
import { TerminalTabs, type TermTab } from "./TerminalTabs";
import { Toolbar, type NewTermKind } from "./Toolbar";
import { ConfirmModal } from "./ui/ConfirmModal";

// 控制键条：补软键盘缺失的终端控制键（发到活动终端）。
const KEYS: { label: string; seq: string }[] = [
  { label: "Esc", seq: "\x1b" },
  { label: "Tab", seq: "\x09" },
  { label: "^C", seq: "\x03" },
  { label: "^D", seq: "\x04" },
  { label: "^Z", seq: "\x1a" },
  { label: "↑", seq: "\x1b[A" },
  { label: "↓", seq: "\x1b[B" },
  { label: "←", seq: "\x1b[D" },
  { label: "→", seq: "\x1b[C" },
];

interface Props {
  conn: HostConnection;
  onDisconnect(): void;
}

export function ClientView({ conn, onDisconnect }: Props) {
  const [terminals, setTerminals] = useState<TermTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmKill, setConfirmKill] = useState<TermTab | null>(null);
  const [note, setNote] = useState("");
  const termRef = useRef<MobileTerminalHandle>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, forceTick] = useReducer((x: number) => x + 1, 0);
  const gen = conn.generation;

  // 订阅连接状态/代际变化 → 重渲染
  useEffect(() => conn.onChange(forceTick), [conn]);
  // 前后台恢复：回前台若已断则重连
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") conn.ensureConnected();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [conn]);

  const flash = useCallback((m: string) => {
    setNote(m);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(""), 2500);
  }, []);

  const reload = useCallback(async () => {
    try {
      const r = await conn.listTerminals();
      const tabs: TermTab[] = r.terminals.map((t) => ({ id: t.terminalId, title: t.title || t.terminalId }));
      setTerminals(tabs);
      setActiveId((cur) => cur ?? tabs[0]?.id ?? null);
    } catch (e) {
      flash(`列终端失败：${String(e)}`);
    }
  }, [conn, flash]);

  useEffect(() => {
    void reload();
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, [reload, gen]);

  // L5-4P：拉取桌面发布的工作区，默认定位到当前激活
  useEffect(() => {
    conn
      .listWorkspaces()
      .then((r) => {
        setWorkspaces(r.workspaces);
        setActiveWsId((cur) => cur ?? r.activeId ?? r.workspaces[0]?.id ?? null);
      })
      .catch(() => {});
  }, [conn, gen]);

  async function newTerminal(kind: NewTermKind) {
    try {
      const id = await conn.createTerminal(80, 24);
      const title = kind === "claude" ? "Claude" : kind === "codex" ? "Codex" : "PowerShell";
      setTerminals((prev) => [...prev, { id, title }]);
      setActiveId(id);
      setSidebarOpen(false);
      if (kind !== "shell") {
        // 等终端订阅 + shell 就绪后发启动命令（v1：固定延时）
        setTimeout(() => termRef.current?.sendKey(kind === "claude" ? "claude\r" : "codex\r"), 900);
      }
    } catch (e) {
      flash(`新建失败：${String(e)}`);
    }
  }

  async function killTerminal(id: string) {
    try {
      await conn.kill(id);
    } catch (e) {
      flash(`关闭失败：${String(e)}`);
    }
    setTerminals((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }

  const hostName = conn.serverInfo?.hostName ?? "Host";
  const activeTitle = terminals.find((t) => t.id === activeId)?.title ?? "终端";

  return (
    <div className="flex h-full flex-col">
      <div style={{ paddingTop: "env(safe-area-inset-top)", background: "#211e1a" }}>
        <Toolbar
          workspaceLabel={workspaces.find((w) => w.id === activeWsId)?.name ?? hostName}
          workspaces={workspaces.length ? workspaces : [{ id: "_host", name: hostName }]}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onPickWorkspace={(id) => setActiveWsId(id)}
          onNewWorkspace={() => flash("新建工作区请在桌面操作")}
          onNewTerminal={newTerminal}
        />
      </div>

      {conn.state === "reconnecting" && (
        <div className="px-4 py-1 text-center text-xs" style={{ background: "rgba(217,119,87,0.18)", color: "var(--accent)" }}>
          连接断开，重连中…
        </div>
      )}

      <TerminalTabs
        terminals={terminals}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onClose={(id) => setConfirmKill(terminals.find((t) => t.id === id) ?? null)}
      />

      {/* 终端 + 左滑 Content（叠加）*/}
      <div className="relative min-h-0 flex-1">
        {activeId ? (
          <MobileTerminal key={`${activeId}:${conn.generation}`} ref={termRef} conn={conn} terminalId={activeId} />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            还没有终端。
            <br />
            点右上「＋ 终端」新建；桌面打开的终端也会出现在这里。
          </div>
        )}
        <SidebarPanel open={sidebarOpen} conn={conn} activeWs={workspaces.find((w) => w.id === activeWsId) ?? null} />
      </div>

      {note && (
        <div className="px-4 py-1 text-xs" style={{ color: "var(--text-dim)" }}>
          {note}
        </div>
      )}

      {/* 控制键条 */}
      {activeId && (
        <div className="flex gap-1 overflow-x-auto px-2 py-1" style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
          {KEYS.map((k) => (
            <button
              key={k.label}
              onClick={() => termRef.current?.sendKey(k.seq)}
              className="shrink-0 rounded px-2.5 py-1 font-mono text-xs"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <Composer agentLabel={activeTitle} onSend={(text) => termRef.current?.sendKey(text + "\r")} />

      {/* 底部状态 + 断开（携带安全区）*/}
      <div
        className="flex items-center justify-between px-4 py-1.5"
        style={{ background: "#211e1a", borderTop: "1px solid var(--border)", paddingBottom: "max(env(safe-area-inset-bottom), 0.4rem)" }}
      >
        <span className="text-xs" style={{ color: "#10a37f" }}>● {hostName}</span>
        <button onClick={onDisconnect} className="text-xs" style={{ color: "var(--text-dim)" }}>
          断开
        </button>
      </div>

      {confirmKill && (
        <ConfirmModal
          title="关闭终端"
          message={`确定关闭「${confirmKill.title}」？这会结束 Host 上该终端进程。`}
          confirmLabel="关闭"
          danger
          onConfirm={() => {
            void killTerminal(confirmKill.id);
            setConfirmKill(null);
          }}
          onCancel={() => setConfirmKill(null)}
        />
      )}
    </div>
  );
}
