import { appDataDir } from "@tauri-apps/api/path";
import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import type { HostProfile, HostProfileStore } from "./profileStore";

const CLIENT_NAME = "htybox-ios";
const STORE_KEY = "hosts.v1";
const VAULT_FILE = "host-profiles.hold";
const VAULT_PASSWORD = "htybox-ios-host-profile-store-v1";

function encode(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function decode(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

export class StrongholdProfileStore implements HostProfileStore {
  private constructor(
    private readonly stronghold: Stronghold,
    private readonly client: Client,
  ) {}

  static async create(): Promise<StrongholdProfileStore> {
    const vaultPath = `${await appDataDir()}/${VAULT_FILE}`;
    const stronghold = await Stronghold.load(vaultPath, VAULT_PASSWORD);
    let client: Client;
    try {
      client = await stronghold.loadClient(CLIENT_NAME);
    } catch {
      client = await stronghold.createClient(CLIENT_NAME);
      await stronghold.save();
    }
    return new StrongholdProfileStore(stronghold, client);
  }

  async list(): Promise<HostProfile[]> {
    const raw = await this.client.getStore().get(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(decode(raw)) as HostProfile[];
  }

  async upsert(profile: HostProfile): Promise<void> {
    const all = await this.list();
    const index = all.findIndex((item) => item.serverId === profile.serverId);
    if (index >= 0) all[index] = { ...profile, createdAt: all[index].createdAt };
    else all.push(profile);
    await this.write(all);
  }

  async remove(serverId: string): Promise<void> {
    const all = (await this.list()).filter((item) => item.serverId !== serverId);
    await this.write(all);
  }

  private async write(profiles: HostProfile[]): Promise<void> {
    await this.client.getStore().insert(STORE_KEY, encode(JSON.stringify(profiles)));
    await this.stronghold.save();
  }
}
