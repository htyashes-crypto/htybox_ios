// iOS 端连接管理器：包 @htybox/link 的 connectLan + DaemonClient，做终端 RPC + 订阅去重。
// 重连/重订阅编排在 Step 5 接入（订阅登记已预留）。

import {
  connectLan,
  RpcTypes,
  type ConnectionOffer,
  type CreateTerminalResult,
  type LanConnection,
  type RestoreMode,
  type ServerInfo,
  type SubscribeTerminalResult,
  type TerminalListResult,
  type WorkspacesResult,
  type SkillsResult,
  type MemoriesResult,
  type FilesResult,
  type SessionsResult,
} from "@htybox/link";
import { createRevisionGate } from "./revisionGate";

export type ConnState = "idle" | "connecting" | "connected" | "closed" | "error";

export class HostConnection {
  private conn: LanConnection | null = null;
  state: ConnState = "idle";

  get serverInfo(): ServerInfo | null {
    return this.conn?.serverInfo ?? null;
  }

  async connect(offer: ConnectionOffer, clientId: string, appVersion: string): Promise<ServerInfo> {
    this.state = "connecting";
    try {
      this.conn = await connectLan(offer, { clientId, clientType: "ios", appVersion });
      this.state = "connected";
      return this.conn.serverInfo;
    } catch (e) {
      this.state = "error";
      throw e;
    }
  }

  private client() {
    if (!this.conn) throw new Error("未连接 Host");
    return this.conn.client;
  }

  listTerminals(): Promise<TerminalListResult> {
    return this.client().request<TerminalListResult>(RpcTypes.terminalList, {});
  }

  /** 列 Host 已发布的工作区（桌面前端经 set_workspaces 发布）。 */
  listWorkspaces(): Promise<WorkspacesResult> {
    return this.client().request<WorkspacesResult>(RpcTypes.hostWorkspacesList, {});
  }

  // ── 只读 catalog（镜像桌面左侧 Content）──
  listSkills(projectDir: string): Promise<SkillsResult> {
    return this.client().request<SkillsResult>(RpcTypes.catalogSkillsList, { projectDir });
  }
  listMemories(slug: string): Promise<MemoriesResult> {
    return this.client().request<MemoriesResult>(RpcTypes.catalogMemoriesList, { slug });
  }
  listFiles(dir: string): Promise<FilesResult> {
    return this.client().request<FilesResult>(RpcTypes.catalogFilesList, { dir });
  }
  listSessions(cwd: string): Promise<SessionsResult> {
    return this.client().request<SessionsResult>(RpcTypes.catalogSessionsList, { cwd });
  }

  async createTerminal(cols: number, rows: number): Promise<string> {
    const r = await this.client().request<CreateTerminalResult>(RpcTypes.terminalCreate, { cols, rows });
    return r.terminalId;
  }

  /** 订阅终端：内部按 revision 去重后把字节交 onData（写入 xterm）。 */
  async subscribe(
    terminalId: string,
    restore: RestoreMode,
    onData: (bytes: Uint8Array) => void,
  ): Promise<SubscribeTerminalResult> {
    const gate = createRevisionGate();
    return this.client().subscribeTerminal(terminalId, restore, (rev, data) => {
      if (gate(rev)) onData(data);
    });
  }

  /** 释放对某终端的订阅（不杀终端）。清理路径用，连接已断则忽略。 */
  async unsubscribe(terminalId: string): Promise<void> {
    if (this.state !== "connected") return;
    try {
      await this.client().request(RpcTypes.terminalUnsubscribe, { terminalId });
    } catch {
      // 连接可能已断，卸载清理路径忽略
    }
  }

  sendInput(slot: number, bytes: Uint8Array): void {
    this.client().sendInput(slot, bytes);
  }
  sendResize(slot: number, cols: number, rows: number): void {
    this.client().sendResize(slot, cols, rows);
  }
  kill(terminalId: string): Promise<unknown> {
    return this.client().request(RpcTypes.terminalKill, { terminalId });
  }
  close(): void {
    this.conn?.close();
    this.conn = null;
    this.state = "closed";
  }
}
