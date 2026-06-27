import { useState } from "react";

type Tab = "skill" | "memory" | "file" | "session";
const TABS: { key: Tab; label: string }[] = [
  { key: "skill", label: "Skill" },
  { key: "memory", label: "Memory" },
  { key: "file", label: "File" },
  { key: "session", label: "Session" },
];

interface Props {
  open: boolean;
}

// 左侧 Content（镜像桌面 Sidebar）。容器左右滑动动画；各 tab 数据由 Step 4P 协议接入。
export function SidebarPanel({ open }: Props) {
  const [tab, setTab] = useState<Tab>("skill");
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
      {/* tab 行 */}
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
      {/* 内容（占位，Step 4P 接 skills/memories/files/sessions 只读 RPC）*/}
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          {TABS.find((t) => t.key === tab)?.label} 列表
          <br />
          <span className="text-xs">（镜像桌面左侧 Content，待协议接入 · Step 4P）</span>
        </div>
      </div>
    </div>
  );
}
