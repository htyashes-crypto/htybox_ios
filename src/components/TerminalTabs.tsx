export interface TermTab {
  id: string;
  title: string;
}

interface Props {
  terminals: TermTab[];
  activeId: string | null;
  onSelect(id: string): void;
  onClose(id: string): void;
}

export function TerminalTabs({ terminals, activeId, onSelect, onClose }: Props) {
  if (terminals.length === 0) return null;
  return (
    <div className="flex gap-1 overflow-x-auto px-2 py-1.5" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      {terminals.map((t) => {
        const active = t.id === activeId;
        return (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-1.5"
            style={{
              background: active ? "var(--surface)" : "transparent",
              borderBottom: active ? "2px solid #10a37f" : "2px solid transparent",
            }}
          >
            <span className="font-mono text-xs" style={{ color: active ? "var(--text)" : "var(--text-dim)" }}>
              &gt;_ {t.title}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
              aria-label="关闭终端"
              className="text-xs"
              style={{ color: "var(--text-dim)" }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
