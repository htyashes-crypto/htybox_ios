// L5 Step 1 脚手架占位外壳。配对/Host 列表/终端列表/终端视图在 Step 3–4 接入。
// 这里顺带真实引用 @htybox/link（验 alias + tweetnacl 在打包器下可解析）。
import { PROTOCOL_VERSION, generateKeyPair } from "@htybox/link";

const probeKeyLen = generateKeyPair().publicKey.length; // 应为 32，证明 tweetnacl 走通

export default function App() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>
        HtyBox
      </div>
      <div className="text-sm" style={{ color: "var(--text-dim)" }}>
        移动端客户端 · L5 脚手架就绪
      </div>
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>
        protocol v{PROTOCOL_VERSION} · link probe {probeKeyLen === 32 ? "OK" : "FAIL"}
      </div>
    </div>
  );
}
