// 自定义确认弹窗（UI 铁律：禁用原生 confirm）。点遮罩或取消=放弃。
interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmModal({ title, message, confirmLabel = "确定", danger, onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </div>
        <div className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
          {message}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm" style={{ color: "var(--text)", border: "1px solid var(--border)" }}>
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded px-3 py-1.5 text-sm font-medium"
            style={{ background: danger ? "#c0392b" : "var(--accent)", color: "#fff" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
