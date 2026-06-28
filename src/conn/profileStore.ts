// HostProfile 持久化（spec §7.3）。HostProfileStore 异步接口 + localStorage 实现。
// StrongholdProfileStore 保留为原生安全存储实现，默认路径先用 localStorage 保证配对流程稳定。
import type { ConnectionOffer } from "@htybox/link";

export interface HostProfile {
  serverId: string;
  label: string;
  hostName: string;
  hostPublicKeyB64: string;
  lan?: { host: string; port: number };
  relay?: { endpoint: string; useTls: boolean }; // L4 起：HostConnection 选路用（LAN 优先回退 relay）
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

/** web / 设备默认实现；Host 公钥是信任锚但非密钥，后续可切 StrongholdProfileStore。 */
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
