// L5 移动端外壳：Host 列表 → 配对 / 连接 → ClientView（镜像整个客户端）。
import { useCallback, useEffect, useState } from "react";
import { getClientId } from "./conn/clientId";
import { HostConnection } from "./conn/connection";
import { LocalStorageProfileStore, offerFromProfile, profileFromOffer, type HostProfile } from "./conn/profileStore";
import { ClientView } from "./components/ClientView";
import { HostList } from "./components/HostList";
import { PairingScreen } from "./components/PairingScreen";

const APP_VERSION = "0.1.0";
type Screen = "hosts" | "pairing" | "client";

export default function App() {
  const [store] = useState(() => new LocalStorageProfileStore());
  const [profiles, setProfiles] = useState<HostProfile[]>([]);
  const [screen, setScreen] = useState<Screen>("hosts");
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
      setScreen("client");
    } catch (e) {
      setError(`连接失败：${String(e)}`);
    } finally {
      setBusy("");
    }
  }

  function disconnect() {
    conn?.close();
    setConn(null);
    setScreen("hosts");
  }

  if (screen === "pairing") {
    return (
      <PairingScreen
        onCancel={() => setScreen("hosts")}
        onPaired={async (offer) => {
          await store.upsert(profileFromOffer(offer));
          await reload();
          setScreen("hosts");
        }}
      />
    );
  }
  if (screen === "client" && conn) {
    return <ClientView conn={conn} onDisconnect={disconnect} />;
  }
  return (
    <HostList
      profiles={profiles}
      busy={busy}
      error={error}
      onPair={() => setScreen("pairing")}
      onConnect={connectTo}
      onDelete={async (sid) => {
        await store.remove(sid);
        await reload();
      }}
    />
  );
}
