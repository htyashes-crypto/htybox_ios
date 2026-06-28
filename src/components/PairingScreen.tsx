import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { checkPermissions, Format, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner";
import { parseOfferUrl, type ConnectionOffer } from "@htybox/link";

interface Props {
  onPaired(offer: ConnectionOffer): void | Promise<void>;
  onCancel(): void;
}

export function PairingScreen({ onPaired, onCancel }: Props) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const canScan = isTauri();

  function parseOffer(input: string): ConnectionOffer {
    const t = input.trim();
    if (!t) throw new Error("请输入配对链接或 offer JSON");
    const offer: ConnectionOffer = t.startsWith("htybox://") ? parseOfferUrl(t) : (JSON.parse(t) as ConnectionOffer);
    if (!offer.serverId || !offer.hostPublicKeyB64) throw new Error("offer 缺 serverId 或公钥");
    if (!offer.lan) throw new Error("offer 无 LAN 端点（本阶段仅支持 LAN 直连）");
    return offer;
  }

  async function add() {
    if (adding) return;
    setAdding(true);
    setErr("");
    try {
      await onPaired(parseOffer(text));
    } catch (e) {
      setErr(`添加失败：${String(e)}`);
    } finally {
      setAdding(false);
    }
  }

  async function scanOffer() {
    if (!canScan || scanning) return;
    setScanning(true);
    setErr("");
    try {
      let permission = await checkPermissions();
      if (permission !== "granted") permission = await requestPermissions();
      if (permission !== "granted") throw new Error("相机权限未开启，无法扫码配对");

      const result = await scan({ cameraDirection: "back", formats: [Format.QRCode] });
      setText(result.content);
      await onPaired(parseOffer(result.content));
    } catch (e) {
      setErr(`扫码失败：${String(e)}`);
    } finally {
      setScanning(false);
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
        onClick={() => void scanOffer()}
        disabled={!canScan || scanning}
        className="rounded px-4 py-2 text-sm"
        style={{ background: "var(--surface-2)", color: canScan ? "var(--text)" : "var(--text-dim)", border: "1px solid var(--border)" }}
      >
        {scanning ? "扫码中…" : canScan ? "📷 扫码配对" : "📷 扫码（设备版可用）"}
      </button>
      <button
        onClick={() => void add()}
        disabled={adding}
        className="rounded px-4 py-2 text-sm font-medium"
        style={{ background: "var(--accent)", color: "#fff", opacity: adding ? 0.7 : 1 }}
      >
        {adding ? "添加中…" : "添加 Host"}
      </button>
      {err && (
        <div className="text-xs" style={{ color: "#e06c5b" }}>
          {err}
        </div>
      )}
    </div>
  );
}
