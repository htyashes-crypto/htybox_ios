// 通用下拉浮层（工作区切换 / 新建终端 共用）。手机窄屏：点工具栏按钮弹出。
export interface DropdownItem {
  key: string;
  label: string;
  sublabel?: string;
  color?: string; // 文字色（覆盖默认）
  glyph?: string; // 行首小符号（如 ✻ / ✦ / >_）
  active?: boolean; // 当前项打勾
}

interface Props {
  open: boolean;
  onClose(): void;
  items: DropdownItem[];
  onSelect(key: string): void;
  /** 浮层定位（相对视口）。 */
  anchor: { top: number; left?: number; right?: number };
  width?: number;
  footer?: { label: string; onClick(): void };
}

export function Dropdown({ open, onClose, items, onSelect, anchor, width = 180, footer }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute rounded-xl py-1 shadow-lg"
        style={{
          top: anchor.top,
          left: anchor.left,
          right: anchor.right,
          width,
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => {
              onSelect(it.key);
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
          >
            {it.glyph && (
              <span className="font-mono text-sm" style={{ color: it.color ?? "var(--text)" }}>
                {it.glyph}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm" style={{ color: it.color ?? "var(--text)", fontWeight: it.active ? 700 : 400 }}>
                {it.label}
              </span>
              {it.sublabel && (
                <span className="block truncate text-xs" style={{ color: "var(--text-dim)" }}>
                  {it.sublabel}
                </span>
              )}
            </span>
            {it.active && <span className="text-sm" style={{ color: "var(--accent)" }}>✓</span>}
          </button>
        ))}
        {footer && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <button
              onClick={() => {
                footer.onClick();
                onClose();
              }}
              className="w-full px-3 py-2.5 text-left text-sm font-medium"
              style={{ color: "var(--accent)" }}
            >
              {footer.label}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
