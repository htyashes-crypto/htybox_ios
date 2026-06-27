# HtyBox iOS 客户端 — Mac 侧对接文档（喂给 Mac 上的 AI）

> 你（Mac 上的 AI）要接手 **HtyBox 双端方案的 L5 里程碑 · Step 6：把已写好的 iOS web 客户端用 Tauri Mobile 封装成真 iOS app 并真机跑通**。
> Windows 侧已完成 Step 1–5（整套 LAN 客户端，浏览器可验），Step 6 需 macOS + Xcode，故交给你。
> 全程回复用**简体中文**。

---

## 0. TL;DR（先看这段）

- **项目**：HtyBox = 桌面多终端工作台；双端 = 手机扫码配对后，经局域网远程**镜像并操控整台桌面客户端**（工作区 + 终端 + 左侧 Skill/Memory/File/Session）。
- **你的任务（Step 6）**：在 `HtyBox_ios` 里 `tauri init` + `tauri ios init`，把现有 web 前端封装成 iOS app；接入**扫码**（barcode-scanner）、**安全存储**（Keychain/stronghold）、**iOS 权限**（相机 / 本地网络 / ATS 明文 LAN）；模拟器 + 真机跑通：扫码配对 → 经 LAN 连 Windows 上的 Host → 实时操控终端。
- **已完成**：协议库、连接器（E2E 握手 + 重连 + 超时）、移动端整套 UI（工具栏双下拉 + 终端 Tab + 富输入框 + 左滑真实侧栏）、工作区与侧栏内容镜像。**这些都不用你重写，直接复用。**
- **铁律**：写任何调用代码前先查实际 API 签名（Tauri 2 mobile / 插件 / 等），不要凭印象；不动桌面 HtyBox 前端；所有弹窗自定义。

---

## 1. 仓库同步与目录布局（关键，先做对）

Mac 上需要**两个同级文件夹**（名字必须一致）：

```
<某父目录>/
  HtyBox_ios/      ← clone 自 github.com/htyashes-crypto/htybox_ios
  HtyBox_link/     ← clone 自 github.com/htyashes-crypto/htybox_link
```

- **为什么要 HtyBox_link**：`HtyBox_ios` 经 **vite alias + tsconfig paths** 引用协议库源码 `../HtyBox_link/ts/src/index.ts`（见 `HtyBox_ios/vite.config.ts` 的 `resolve.alias["@htybox/link"]` 与 `tsconfig.json` 的 `paths`）。两者必须**同级**，否则 `pnpm build`/`dev` 解析不到 `@htybox/link`。
- **不需要** clone HtyBox（桌面 Host，Windows 专属）或 paseo（参考）。
- 包管理器用 **pnpm**。两仓各 `pnpm install`。
- Mac 上构建 iOS 还需：Xcode + 命令行工具、CocoaPods、Rust + `aarch64-apple-ios`/`aarch64-apple-ios-sim` target、`@tauri-apps/cli` v2。

> 注：Windows 侧这两仓均为**独立 git 仓库**、本地提交、`main` 分支。外层 `hty_workflows` **不是** git 仓库（嵌套仓库会变 gitlink 空指针，勿整体推送）。

---

## 2. 你要做什么（Step 6 概览）

现状：`HtyBox_ios` 是一个**纯 web 前端**（Vite + React 19 + TS + xterm），**还没有 `src-tauri/`**。Step 1–5 把它做成了功能完整、浏览器可验的 iOS web 客户端。Step 6 = 给它加 Tauri Mobile 原生壳并真机跑通：

1. 加 `@tauri-apps/cli` + `@tauri-apps/api`，`tauri init` 生成 `src-tauri/`（指向现有前端）。
2. `tauri ios init` 生成 Xcode 工程（`src-tauri/gen/apple`，仅 macOS）。
3. `tauri add barcode-scanner` 接扫码；选一个安全存储方案接 `HostProfileStore` 原生实现。
4. 配 iOS 权限：相机、**本地网络（NSLocalNetworkUsageDescription）**、**ATS 明文 LAN 例外**（连 `ws://` 用）。
5. 把扫码接进 `PairingScreen`（替代/补充粘贴 offer）；把安全存储接进 `profileStore`。
6. `tauri ios dev`（模拟器）→ 真机构建 → **真机扫码连 Windows Host**。

细节见 §5、§6。

---

## 3. 项目背景与连接模型

- **HtyBox 双端**：Windows 桌面 = **Host**（Tauri + Rust，跑终端、扫 `~/.claude`）；它内置一个 **WS Host**（axum，端口 **6767**）把"htybox-link 协议"暴露出来。手机 = 客户端，扫码配对后经 WS 连上，**镜像整个桌面客户端**。
- **协议契约单一事实来源**：`HtyBox_link/Document/03-protocol-spec.md`（**改协议先改它**）。Rust crate `HtyBox_link/crates/htybox-link` 与 TS 绑定 `HtyBox_link/ts` 两侧对齐。
- **连接 = 连整个客户端**（不是单终端）：连上后能列工作区、列/开/操控终端、看左侧 Skill/Memory/File/Session。
- **传输/分帧**：单条 WS 混合 JSON-RPC（文本帧）+ 终端二进制帧 `[opcode][slot][payload]`；Output/Snapshot/Restore 的 payload 前缀 `revision:u64 BE`。
- **E2E（关键）**：Curve25519 ECDH + XSalsa20-Poly1305。**非 loopback 连接强制 E2E**（手机连 LAN 必走加密）。流程：客户端发明文 `{type:"e2ee_hello",key}` → Host 回 `{type:"e2ee_ready"}` → 双方 `box.before` 出共享密钥 → 此后所有帧封 `[0x00][innerKind][nonce24][ct]`。**这套已由连接器 `connectLan` 实现并验证，你不用碰。**
- **配对 offer**：`htybox://pair#offer=base64url(json)`，含 `serverId / hostName / hostPublicKeyB64 / lan{host,port}`。公钥 = 信任锚。Host 桌面「设置 → 连接」页有二维码 + 复制链接。

---

## 4. HtyBox_ios 架构（已完成，直接复用）

**栈**：Vite 7 + React 19 + TS + Tailwind v4 + `@xterm/xterm` 6；协议层 `@htybox/link`（= `../HtyBox_link/ts/src`）。

**目录**（`HtyBox_ios/src/`）：
- `conn/connection.ts` — `HostConnection`：包 `connectLan` + `DaemonClient`；`connect/listWorkspaces/listTerminals/createTerminal/subscribe(去重)/sendInput/sendResize/kill/unsubscribe/close` + **断线重连**（`onClose`→退避→重连，`generation` 代际，`ensureConnected` 前台恢复）+ catalog 封装 `listSkills/listMemories/listFiles/listSessions`。
- `conn/profileStore.ts` — `HostProfileStore` **异步接口** + `LocalStorageProfileStore`（dev/web 实现）。**Step 6 你加一个原生安全存储实现接同一接口**。`offerFromProfile`/`profileFromOffer`。
- `conn/clientId.ts` — 持久 clientId（`crypto.randomUUID`）。
- `conn/revisionGate.ts` — 终端 revision 去重（spec §6.1）。
- `terminal/MobileTerminal.tsx` — xterm 视图（`forwardRef` 暴露 `sendKey/focus`）；**叠影债防护**：`windowsPty` 禁 reflow（远程渲染器，内容由 Host ConPTY 整屏重绘）+ `parser.registerCsiHandler` 抑制 DA/DSR/光标位/DECRQM 回应（详见 §8）。
- `components/`：`ClientView`（连上后主屏总装）、`Toolbar`（侧栏开关←→滑动 + 工作区▾ + ＋终端▾，窄屏弹下拉）、`ui/Dropdown`（通用下拉）、`TerminalTabs`（终端 Tab）、`Composer`（Claude 风格富输入框：@注入//命令 + ＋附件 + 🎤语音 + ↑发送；**＋附件 与 🎤 目前是占位**）、`SidebarPanel`（左滑 Content，4 tab 真实数据）、`PairingScreen`（粘贴 offer；**扫码按钮是占位，Step 6 接相机**）、`HostList`、`ui/ConfirmModal`。
- `App.tsx` — 路由：`hosts`（配对/Host 列表）→ `pairing` → `client`（`ClientView`）。

**已完成（Step 1–5 + 4R + 4P）功能**：配对/Host 列表 → 连整个客户端 → 工具栏（侧栏开关滑动 + 工作区下拉 + 新建 Claude/Codex/PowerShell 终端下拉）→ 多终端 Tab → xterm 渲染/输入/历史重放 → 富输入框发送 + 控制键条（Esc/^C/方向键）→ 左滑侧栏显示**该工作区真实** Skill/Memory/File(可下钻)/Session(claude/codex 分组) → 断线重连 + 前后台恢复 + 15s RPC 超时。

**验证状态**：真机级 node smoke（E2E + 工作区 + catalog 真实数据）+ ts 24 单测 + 三端 build 全绿；浏览器对真实 Windows Host 手验通过（含终端渲染截图）。**未做的只剩原生封装（Step 6）。**

---

## 5. Step 6 任务详解

> 写每段调用前先查实际 API（Tauri 2 mobile、各插件的当前版本/签名/权限 key）——别凭印象。下面是要点与决策，具体命令见 §6。

### 5.1 初始化 Tauri + iOS 工程
- 装 `@tauri-apps/cli@^2` + `@tauri-apps/api@^2`。
- `pnpm tauri init` 生成 `src-tauri/`：**frontendDist** 指向现有前端产物（`../dist`），**beforeDevCommand**=`pnpm dev`、**beforeBuildCommand**=`pnpm build`、**devUrl**=`http://localhost:1430`（与 `vite.config.ts` 端口一致，`host:true` 已开便于真机访问 dev server）。**identifier** 用 `com.htybox.ios`、productName `HtyBox`。
- `pnpm tauri ios init` 生成 Xcode 工程（`src-tauri/gen/apple`）。仅 macOS。
- `lib.rs` 用 `#[cfg_attr(mobile, tauri::mobile_entry_point)] pub fn run()`（`tauri init` 模板默认就是；确认即可）。

### 5.2 扫码（替代/补充粘贴 offer）
- `pnpm tauri add barcode-scanner`（会自动配 Cargo 插件 + JS 包 + 权限）。
- 在 `PairingScreen.tsx` 把现有占位「扫码」按钮接上 `@tauri-apps/plugin-barcode-scanner` 的 `scan()`，扫到 `htybox://pair#offer=...` → 复用现有 `parseOfferUrl`（已 import）→ 走现有 `onPaired`。
- 桌面 Host「设置 → 连接」页有该二维码（`pairing_offer` 命令产出 SVG + 链接）。

### 5.3 安全存储（HostProfile 原生持久化）
- 现 `LocalStorageProfileStore` 仅 web。加一个**原生实现**接同一 `HostProfileStore` 异步接口（`list/upsert/remove`）。方案二选一（你定，记决策）：
  - `tauri-plugin-stronghold`（官方，加密 vault，较重）；或
  - 一个 Keychain 插件 / 经命令封 `Security` 框架（更贴 iOS）。
- 在 `App.tsx` 按平台选实现（设备用原生、web 用 localStorage）。注：信任锚 `hostPublicKeyB64` 是公钥非密钥，泄露风险低，但 `clientId`/凭证宜安全存。

### 5.4 iOS 权限/配置（连 LAN 必需）
- **本地网络**：`NSLocalNetworkUsageDescription`（iOS 14+ 连局域网必须，否则连不上 Host）。
- **ATS 明文**：连 `ws://<lan>:6767`（非 TLS）需 `NSAllowsLocalNetworking`（或针对性例外）。机密性已由应用层 E2E 保证，不依赖 TLS。
- **相机**：`NSCameraUsageDescription`（扫码）。
- 这些 plist key 加到 `tauri ios init` 生成的 Info.plist（或 Tauri 2 的 plist 合并机制，**查当前版本的确切做法**）。

### 5.5 软键盘 / 安全区
- 真机上：点终端聚焦 xterm 隐藏 textarea → 弹软键盘；布局须让输入辅助条 + 富输入框浮在键盘上方。现 CSS 已用 `env(safe-area-inset-*)`；真机微调键盘避让（`visualViewport` 或 Tauri 键盘事件）。

---

## 6. Mac Runbook（按序执行，每步验证）

```bash
# 0) 同级 clone（名字别改）
git clone https://github.com/htyashes-crypto/htybox_ios.git   HtyBox_ios
git clone https://github.com/htyashes-crypto/htybox_link.git  HtyBox_link

# 1) 依赖
cd HtyBox_link/ts && pnpm install && pnpm typecheck && pnpm test   # 协议库（应 24 测试绿）
cd ../../HtyBox_ios && pnpm install && pnpm build                  # 先确认 web 前端能 build

# 2) 加 Tauri CLI/API + 初始化
pnpm add -D @tauri-apps/cli@^2 && pnpm add @tauri-apps/api@^2
pnpm tauri init      # 配 frontendDist=../dist, devUrl=http://localhost:1430,
                     # beforeDevCommand="pnpm dev", beforeBuildCommand="pnpm build",
                     # identifier=com.htybox.ios, productName=HtyBox
pnpm tauri ios init  # 生成 Xcode 工程（macOS）

# 3) 插件
pnpm tauri add barcode-scanner
#   + 安全存储插件（stronghold 或 keychain），按 §5.3

# 4) 权限：编辑 Info.plist 加 NSLocalNetworkUsageDescription / NSAllowsLocalNetworking / NSCameraUsageDescription
#   capabilities 里放行 barcode-scanner 等权限

# 5) 跑模拟器（先验 UI；模拟器连不了你 Windows 的 LAN Host，仅验界面/编译）
pnpm tauri ios dev

# 6) 真机：Xcode 选签名 team，连真机
pnpm tauri ios dev --host   # 或 build 出 ipa 装机
```

> 注：`tauri ios dev`/`build` 仅 macOS 能跑。Windows 侧无法编译 iOS target，故 Windows 上没验证过 `src-tauri`——**编译/真机以你 Mac 为准**。

---

## 7. 联调测试（真机 ↔ Windows Host，经 LAN）

1. **Windows 侧**（用户操作）：跑 HtyBox 桌面 app（安装版或 `pnpm tauri dev`）→「设置 → 连接」**开 LAN 开关并重启 app**（LAN 默认关，绑 `0.0.0.0:6767` 需重启生效）→ 该页有**二维码 + 复制链接**（offer，已含 Windows 的局域网 IP）。
2. 手机与 Windows **同一 Wi-Fi**。Windows 防火墙放行 6767 入站（LAN）。
3. **iOS app**：扫码（或粘贴链接）→ 连接 → 应看到工作区、终端、左侧真实内容，可操控。
4. 校验点：E2E 握手成功（server_info）、`serverId` 一致、终端历史重放 + 实时 I/O、点红框侧栏滑入显示真实 Skill/Memory/File/Session、断 Wi-Fi 重连 banner + 恢复。
5. **注意**：`127.0.0.1` 的 dev offer 只适合同机浏览器调试；真机必须用桌面「连接」页的 **LAN offer**（含 Windows 局域网 IP）。

---

## 8. 约定与坑（务必遵守）

- **包管理 pnpm**；`@htybox/link` 靠 **HtyBox_ios 与 HtyBox_link 同级** + vite alias/tsconfig paths 解析（别改成 npm 包名安装）。
- **不改 HtyBox 桌面前端 / 桌面 Host**（那是 Windows 侧、已完工）；你只动 `HtyBox_ios`（必要时 `HtyBox_link/ts` 协议层，但改协议先改 `Document/03-protocol-spec.md` 并保持 Rust/TS 两侧对齐）。
- **叠影技术债**：`MobileTerminal` 已内置两道防护（`windowsPty:{backend:"conpty",buildNumber:19045}` 禁 xterm reflow + `parser.registerCsiHandler` 抑制 DA/DSR/光标位/DECRQM 回应）。**保留别删**——根因是"远程 xterm 不应回应终端协议查询、由 Host ConPTY 独家回应"。背景见 Windows 侧 `.claude/bugs/terminal-overlap-conpty.md`。
- **弹窗全自定义**（禁原生 alert/confirm/prompt）——已有 `ui/ConfirmModal`，新弹窗照此。
- **cargo 必须在 PowerShell** 那条是 **Windows 专属坑**（Git Bash linker 冲突）；**Mac 上用普通终端 cargo 即可**，无此限制。
- **git**：完成后**本地 commit 即可，用户说推送才 push**（沿用本项目惯例）。
- L5 计划与执行记录在 **Windows 侧** `.claude/plans/2026-06-25-multi-plan-htybox-dualend/`（不在 ios 仓内）。你做完 Step 6 请**结构化回报**（做了什么/改了哪些文件/验证结果/遗留），用户会在 Windows 侧把它归档进计划 §11 + 沉淀 memory。

---

## 9. 关键引用与当前提交状态

**关键文件**：
- 协议契约：`HtyBox_link/Document/03-protocol-spec.md`（单一事实来源）。
- 连接器：`HtyBox_link/ts/src/connect.ts`（`connectLan` = WS + e2ee 握手 + onClose）/ `transport-ws.ts` / `client.ts`（`DaemonClient`，含 15s 超时）。
- iOS 连接管理：`HtyBox_ios/src/conn/connection.ts`。
- 终端视图：`HtyBox_ios/src/terminal/MobileTerminal.tsx`。
- node smoke（参考连接全流程，Windows 侧验过）：`HtyBox_link/ts/scripts/ws-smoke-connect.ts`（`pnpm smoke:connect`）。

**当前各仓 HEAD（Windows 本地，待用户推送到 GitHub 后你 clone 到的就是这些）**：
- `HtyBox_ios` → `85a013c`（Step 5 重连）
- `HtyBox_link` → `b3cc7ab`（Step 5 超时/onClose）
- `HtyBox`（桌面 Host，**Mac 不需要**）→ `e79b4d7`（含 4P 工作区/catalog RPC + serverId 修复）

**Host 侧为 L5 加的能力（已在 Windows 完工，Mac 只是连它）**：`set_workspaces` 命令 + `host.workspaces.list` 真实数据 + `catalog.skills/memories/files/sessions.list` 只读 RPC + E2E/配对/LAN 开关。

---

完成 Step 6 后，HtyBox 双端 L5（LAN 直连 iOS 客户端）即全线打通。relay 远程（L4，异地非同网）是后续独立里程碑，不在本次范围。

