// L5 移动端外壳：Host 列表 → 配对 / 连接 → 终端列表 → 终端视图（无 dockview/allotment）。
import { useCallback, useEffect, useState } from "react";
import { getClientId } from "./conn/clientId";
import { HostConnection } from "./conn/connection";
import { LocalStorageProfileStore, offerFromProfile, profileFromOffer, type HostProfile } from "./conn/profileStore";
import { HostList } from "./components/HostList";
import { PairingScreen } from "./components/PairingScreen";
import { TerminalList } from "./components/TerminalList";
import { TerminalScreen } from "./components/TerminalScreen";

const APP_VERSION = "0.1.0";

type Screen =
  | { name: "hosts" }
  | { name: "pairing" }
  | { name: "terminals" }
  | { name: "terminal"; terminalId: string };

export default function App() {
  const [store] = useState(() => new LocalStorageProfileStore());
  const [profiles, setProfiles] = useState<HostProfile[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "hosts" });
  const [conn, setConn] = useState<HostConnection | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => setProfiles(await store.list()), [store]);
  useEffect(() => {
    void reload();
  }, [reload]);

  async function connectTo(p: HostProfile) {
    setError("");
    setBusy(`连接 ${p.label}…`);
    try {
      const c = new HostConnection();
      await c.connect(offerFromProfile(p), getClientId(), APP_VERSION);
      setConn(c);
      setScreen({ name: "terminals" });
    } catch (e) {
      setError(`连接失败：${String(e)}`);
    } finally {
      setBusy("");
    }
  }

  function disconnect() {
    conn?.close();
    setConn(null);
    setScreen({ name: "hosts" });
  }

  if (screen.name === "pairing") {
    return (
      <PairingScreen
        onCancel={() => setScreen({ name: "hosts" })}
        onPaired={async (offer) => {
          await store.upsert(profileFromOffer(offer));
          await reload();
          setScreen({ name: "hosts" });
        }}
      />
    );
  }
  if (screen.name === "terminals" && conn) {
    return <TerminalList conn={conn} onBack={disconnect} onOpen={(terminalId) => setScreen({ name: "terminal", terminalId })} />;
  }
  if (screen.name === "terminal" && conn) {
    return <TerminalScreen conn={conn} terminalId={screen.terminalId} onBack={() => setScreen({ name: "terminals" })} />;
  }
  return (
    <HostList
      profiles={profiles}
      busy={busy}
      error={error}
      onPair={() => setScreen({ name: "pairing" })}
      onConnect={connectTo}
      onDelete={async (sid) => {
        await store.remove(sid);
        await reload();
      }}
    />
  );
}
