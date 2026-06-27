// L5 Step 3 dev 调试壳：粘贴 offer → connectLan → 新建并打开终端（浏览器对真实 Host 验证）。
// 正式的 配对/Host 列表/终端列表/终端视图 四屏在 Step 4 接入。
import { useState } from "react";
import { parseOfferUrl, type ConnectionOffer } from "@htybox/link";
import { HostConnection } from "./conn/connection";
import { MobileTerminal } from "./terminal/MobileTerminal";

const APP_VERSION = "0.1.0";

export default function App() {
  const [offerText, setOfferText] = useState("");
  const [conn] = useState(() => new HostConnection());
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function go() {
    try {
      setStatus("连接中…");
      const t = offerText.trim();
      const offer: ConnectionOffer = t.startsWith("htybox://") ? parseOfferUrl(t) : (JSON.parse(t) as ConnectionOffer);
      const si = await conn.connect(offer, "ios-dev", APP_VERSION);
      setStatus(`已连接 ${si.hostName} (${si.serverId})，新建终端…`);
      setTerminalId(await conn.createTerminal(80, 24));
      setStatus("");
    } catch (e) {
      setStatus(`失败：${String(e)}`);
    }
  }

  if (terminalId) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)", background: "var(--surface)" }}>
          {conn.serverInfo?.hostName} · {terminalId}
        </div>
        <div className="min-h-0 flex-1">
          <MobileTerminal conn={conn} terminalId={terminalId} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
      <div className="text-lg font-semibold" style={{ color: "var(--accent)" }}>
        HtyBox · 连接 Host（dev）
      </div>
      <textarea
        value={offerText}
        onChange={(e) => setOfferText(e.target.value)}
        placeholder="粘贴 offer 链接（htybox://pair#offer=…）或 offer JSON"
        className="min-h-28 w-full rounded p-2 font-mono text-sm"
        style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
      />
      <button
        onClick={go}
        className="rounded px-4 py-2 text-sm font-medium"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        连接并开终端
      </button>
      {status && (
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>
          {status}
        </div>
      )}
    </div>
  );
}
