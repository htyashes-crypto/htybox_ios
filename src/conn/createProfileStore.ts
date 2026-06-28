import { isTauri } from "@tauri-apps/api/core";
import { LocalStorageProfileStore, type HostProfileStore } from "./profileStore";

export async function createProfileStore(): Promise<HostProfileStore> {
  if (!isTauri()) return new LocalStorageProfileStore();
  try {
    const { StrongholdProfileStore } = await import("./strongholdProfileStore");
    return await StrongholdProfileStore.create();
  } catch (e) {
    console.warn("Falling back to localStorage profile store:", e);
    return new LocalStorageProfileStore();
  }
}
