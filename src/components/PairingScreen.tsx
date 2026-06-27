import { useState } from "react";
import { parseOfferUrl, type ConnectionOffer } from "@htybox/link";

interface Props {
  onPaired(offer: ConnectionOffer): void;
  onCancel(): void;
}

export function PairingScreen({ onPaired, onCancel }: Props) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  function add() {
    try {
      const t = text.trim();
      if (!t) return;
      const offer: ConnectionOffer = t.startsWith("htybox://") ? parseOfferUrl(t) : (JSON.parse(t) as ConnectionOffer);
      if (!offer.serverId || !offer.hostPublicKeyB64) throw new Error("offer 缺 serverId 或公钥");
      if (!offer.lan) throw new Error("offer 无 LAN 端点（本阶段仅支持 LAN 直连）");
      onPaired(offer);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
          配对 Host
        </div>
        <button onClick={onCancel} className="text-sm" style={{ color: "var(--accent)" }}>
          取消
        </button>
      </div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
        在桌面 HtyBox「设置 → 连接」复制配对链接，粘贴到下面。（设备版可直接扫二维码。）
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setErr("");
        }}
        placeholder="htybox://pair#offer=… 或 offer JSON"
        className="min-h-28 w-full rounded p-2 font-mono text-sm"
        style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
      />
      <button
        disabled
        className="rounded px-4 py-2 text-sm"
        style={{ background: "var(--surface-2)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
      >
        📷 扫码（设备版，Step 6 接入）
      </button>
      <button onClick={add} className="rounded px-4 py-2 text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
        添加 Host
      </button>
      {err && (
        <div className="text-xs" style={{ color: "#e06c5b" }}>
          {err}
        </div>
      )}
    </div>
  );
}
