import { useRef, useState } from "react";
import { Dropdown, type DropdownItem } from "./ui/Dropdown";

export interface WorkspaceOpt {
  id: string;
  name: string;
}
export type NewTermKind = "claude" | "codex" | "shell";

interface Props {
  workspaceLabel: string;
  workspaces: WorkspaceOpt[];
  sidebarOpen: boolean;
  onToggleSidebar(): void;
  onPickWorkspace(id: string): void;
  onNewWorkspace(): void;
  onNewTerminal(kind: NewTermKind): void;
}

export function Toolbar({ workspaceLabel, workspaces, sidebarOpen, onToggleSidebar, onPickWorkspace, onNewWorkspace, onNewTerminal }: Props) {
  const wsRef = useRef<HTMLButtonElement>(null);
  const ntRef = useRef<HTMLButtonElement>(null);
  const [wsOpen, setWsOpen] = useState(false);
  const [ntOpen, setNtOpen] = useState(false);
  const [wsAnchor, setWsAnchor] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [ntAnchor, setNtAnchor] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  function openWs() {
    const r = wsRef.current?.getBoundingClientRect();
    if (r) setWsAnchor({ top: r.bottom + 4, left: r.left });
    setWsOpen(true);
  }
  function openNt() {
    const r = ntRef.current?.getBoundingClientRect();
    if (r) setNtAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setNtOpen(true);
  }

  const wsItems: DropdownItem[] = workspaces.map((w) => ({ key: w.id, label: w.name, active: w.name === workspaceLabel }));
  const ntItems: DropdownItem[] = [
    { key: "claude", label: "Claude Code", glyph: "✻", color: "var(--accent)" },
    { key: "codex", label: "Codex", glyph: "✦", color: "#10a37f" },
    { key: "shell", label: "PowerShell", glyph: ">_" },
  ];

  return (
    <div className="flex items-center gap-2 px-2" style={{ height: 48, background: "#211e1a", borderBottom: "1px solid var(--border)" }}>
      {/* 侧栏开关：点击 ←→ 滑动切换 终端/Content */}
      <button
        onClick={onToggleSidebar}
        aria-label="切换侧栏"
        className="grid h-8 w-9 shrink-0 place-items-center rounded-lg"
        style={{ background: sidebarOpen ? "var(--accent)" : "transparent", border: `1.5px solid var(--accent)` }}
      >
        <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
          <rect x="0.75" y="0.75" width="16.5" height="14.5" rx="2.5" stroke={sidebarOpen ? "#1a1815" : "#d97757"} strokeWidth="1.5" />
          <rect x="3" y="3" width="4.5" height="10" rx="1" fill={sidebarOpen ? "#1a1815" : "#d97757"} />
        </svg>
      </button>

      {/* 工作区下拉按钮 */}
      <button
        ref={wsRef}
        onClick={openWs}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-3"
        style={{ height: 32, background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold" style={{ color: "var(--text)" }}>
          {workspaceLabel}
        </span>
        <span style={{ color: "var(--text-dim)" }}>▾</span>
      </button>

      {/* 新建终端下拉按钮 */}
      <button
        ref={ntRef}
        onClick={openNt}
        className="flex shrink-0 items-center gap-1 rounded-lg px-3"
        style={{ height: 32, background: "rgba(217,119,87,0.14)", border: "1px solid var(--accent)" }}
      >
        <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>＋</span>
        <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>终端</span>
        <span className="text-xs" style={{ color: "var(--accent)" }}>▾</span>
      </button>

      <Dropdown
        open={wsOpen}
        onClose={() => setWsOpen(false)}
        items={wsItems}
        onSelect={onPickWorkspace}
        anchor={wsAnchor}
        width={200}
        footer={{ label: "＋ 新建工作区", onClick: onNewWorkspace }}
      />
      <Dropdown open={ntOpen} onClose={() => setNtOpen(false)} items={ntItems} onSelect={(k) => onNewTerminal(k as NewTermKind)} anchor={ntAnchor} width={170} />
    </div>
  );
}
