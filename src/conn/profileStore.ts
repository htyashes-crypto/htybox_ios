// HostProfile 持久化（spec §7.3）。HostProfileStore 异步接口 + localStorage 实现（dev）；
// 设备原生安全存储（Keychain / stronghold）实现见 Step 6，接同一异步接口（决策 4）。
import type { ConnectionOffer } from "@htybox/link";

export interface HostProfile {
  serverId: string;
  label: string;
  hostName: string;
  hostPublicKeyB64: string;
  lan?: { host: string; port: number };
  relay?: { endpoint: string; useTls: boolean }; // 预留，L5 不连
  createdAt: number;
  updatedAt: number;
}

/** 由 HostProfile 重建连接用的 ConnectionOffer。 */
export function offerFromProfile(p: HostProfile): ConnectionOffer {
  return { v: 1, serverId: p.serverId, hostName: p.hostName, hostPublicKeyB64: p.hostPublicKeyB64, lan: p.lan, relay: p.relay };
}

/** 由配对得到的 offer 建 HostProfile。 */
export function profileFromOffer(offer: ConnectionOffer): HostProfile {
  const now = Date.now();
  return {
    serverId: offer.serverId,
    label: offer.hostName || offer.serverId,
    hostName: offer.hostName,
    hostPublicKeyB64: offer.hostPublicKeyB64,
    lan: offer.lan,
    relay: offer.relay,
    createdAt: now,
    updatedAt: now,
  };
}

export interface HostProfileStore {
  list(): Promise<HostProfile[]>;
  upsert(p: HostProfile): Promise<void>;
  remove(serverId: string): Promise<void>;
}

const KEY = "htybox.ios.hosts.v1";

/** dev / web 实现；设备上由原生安全存储实现替换（同接口）。 */
export class LocalStorageProfileStore implements HostProfileStore {
  async list(): Promise<HostProfile[]> {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HostProfile[];
  }
  async upsert(p: HostProfile): Promise<void> {
    const all = await this.list();
    const i = all.findIndex((x) => x.serverId === p.serverId);
    if (i >= 0) all[i] = { ...p, createdAt: all[i].createdAt };
    else all.push(p);
    localStorage.setItem(KEY, JSON.stringify(all));
  }
  async remove(serverId: string): Promise<void> {
    const all = (await this.list()).filter((x) => x.serverId !== serverId);
    localStorage.setItem(KEY, JSON.stringify(all));
  }
}
