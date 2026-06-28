// iOS 端连接管理器：包 @htybox/link 的 connectLan + DaemonClient，做终端 RPC + 订阅去重。
// 重连/重订阅编排在 Step 5 接入（订阅登记已预留）。

import {
  connectLan,
  connectRelay,
  makeBackoff,
  RpcTypes,
  type Connection,
  type ConnectionOffer,
  type ConnectOptions,
  type CreateTerminalResult,
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

export type ConnState = "idle" | "connecting" | "connected" | "reconnecting" | "closed" | "error";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class HostConnection {
  private conn: Connection | null = null;
  state: ConnState = "idle";
  /** 当前连接路径（UI 显示 LAN/relay）。 */
  path: "lan" | "relay" | null = null;
  /** 每次成功(重)连 +1；UI 据此重挂终端、重订阅、刷新列表。 */
  generation = 0;
  private offer: ConnectionOffer | null = null;
  private clientId = "";
  private appVersion = "";
  private listeners = new Set<() => void>();
  private reconnecting = false;

  get serverInfo(): ServerInfo | null {
    return this.conn?.serverInfo ?? null;
  }

  /** 订阅连接状态/代际变化；返回取消。 */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }
  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  async connect(offer: ConnectionOffer, clientId: string, appVersion: string): Promise<ServerInfo> {
    this.offer = offer;
    this.clientId = clientId;
    this.appVersion = appVersion;
    return this.open();
  }

  private async open(): Promise<ServerInfo> {
    if (!this.offer) throw new Error("未配置 offer");
    this.state = this.generation === 0 ? "connecting" : "reconnecting";
    this.emit();
    const opts: ConnectOptions = {
      clientId: this.clientId,
      clientType: "ios",
      appVersion: this.appVersion,
      onClose: () => this.onClosed(),
    };
    try {
      this.conn = await this.dial(opts);
    } catch (e) {
      if (this.generation === 0) {
        this.state = "error";
        this.emit();
      }
      throw e;
    }
    this.state = "connected";
    this.generation += 1;
    this.emit();
    return this.conn.serverInfo;
  }

  /** 选路（决策5=A）：LAN 优先（offer 有 lan 先试），失败或无 lan 再走 relay 中继。 */
  private async dial(opts: ConnectOptions): Promise<Connection> {
    const offer = this.offer!;
    if (offer.lan) {
      try {
        const c = await connectLan(offer, opts);
        this.path = "lan";
        return c;
      } catch (e) {
        if (!offer.relay) throw e; // 无 relay 兜底 → 抛原错误
      }
    }
    if (offer.relay) {
      const c = await connectRelay(offer, opts);
      this.path = "relay";
      return c;
    }
    throw new Error("offer 既无 lan 也无 relay 端点");
  }

  private onClosed(): void {
    if (this.state === "closed") return;
    this.conn = null;
    if (!this.reconnecting) void this.reconnect();
  }

  private async reconnect(): Promise<void> {
    this.reconnecting = true;
    this.state = "reconnecting";
    this.emit();
    const backoff = makeBackoff();
    while ((this.state as ConnState) !== "closed" && !this.conn) {
      await delay(backoff.next());
      if ((this.state as ConnState) === "closed") break;
      try {
        await this.open();
      } catch {
        /* 继续退避重试，open 内已 emit */
      }
    }
    this.reconnecting = false;
  }

  /** 前台恢复：若已断且未在重连，触发重连。 */
  ensureConnected(): void {
    if (this.state !== "connected" && !this.reconnecting && this.offer) void this.reconnect();
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
    this.state = "closed";
    this.conn?.close();
    this.conn = null;
    this.path = null;
    this.emit();
  }
}
