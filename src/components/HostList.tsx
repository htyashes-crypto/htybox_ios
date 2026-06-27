import { useState } from "react";
import type { HostProfile } from "../conn/profileStore";
import { ConfirmModal } from "./ui/ConfirmModal";

interface Props {
  profiles: HostProfile[];
  busy?: string;
  error?: string;
  onPair(): void;
  onConnect(p: HostProfile): void;
  onDelete(serverId: string): void;
}

export function HostList({ profiles, busy, error, onPair, onConnect, onDelete }: Props) {
  const [confirm, setConfirm] = useState<HostProfile | null>(null);
  return (
    <div className="flex h-full flex-col" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-lg font-semibold" style={{ color: "var(--accent)" }}>
          HtyBox · Host
        </div>
        <button onClick={onPair} className="rounded px-3 py-1.5 text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
          + 配对
        </button>
      </div>
      {error && (
        <div className="mx-4 mb-2 rounded p-2 text-xs" style={{ background: "rgba(192,57,43,0.15)", color: "#e06c5b" }}>
          {error}
        </div>
      )}
      {busy && (
        <div className="px-4 py-1 text-xs" style={{ color: "var(--text-dim)" }}>
          {busy}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {profiles.length === 0 ? (
          <div className="mt-12 text-center text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            还没有配对的 Host。
            <br />
            点右上「+ 配对」添加。
          </div>
        ) : (
          profiles.map((p) => (
            <div
              key={p.serverId}
              className="mb-2 flex items-center gap-2 rounded-lg p-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button onClick={() => onConnect(p)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                  {p.label}
                </div>
                <div className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
                  {p.lan ? `${p.lan.host}:${p.lan.port}` : "无 LAN"} · {p.serverId}
                </div>
              </button>
              <button onClick={() => setConfirm(p)} className="shrink-0 rounded px-2 py-1 text-xs" style={{ color: "var(--text-dim)" }}>
                删除
              </button>
            </div>
          ))
        )}
      </div>
      {confirm && (
        <ConfirmModal
          title="删除 Host"
          message={`确定删除「${confirm.label}」？仅移除本机保存的配对，不影响 Host 本身。`}
          confirmLabel="删除"
          danger
          onConfirm={() => {
            onDelete(confirm.serverId);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
