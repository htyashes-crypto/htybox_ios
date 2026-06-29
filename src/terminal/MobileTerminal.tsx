import { Unicode11Addon } from "@xterm/addon-unicode11";
import { Terminal } from "@xterm/xterm";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { HostConnection } from "../conn/connection";

export interface MobileTerminalHandle {
  sendKey(data: string): void;
  focus(): void;
}

interface Props {
  conn: HostConnection;
  terminalId: string;
}

// 抑制前端 xterm 对终端协议查询的自动回应（叠影债 #1，桌面未做的关键修复）：
// 远程 xterm 仅作渲染器，DA/DSR/光标位置/DECRQM 由 Host 端 ConPTY 独家回应；
// 若前端也回应会与 Host 冲突 → claude/codex 收到不一致光标信息 → 内联重绘错位/叠影。
const SUPPRESS_CSI: { prefix?: string; intermediates?: string; final: string }[] = [
  { final: "c" }, // DA1 主设备属性请求
  { prefix: ">", final: "c" }, // DA2 次设备属性
  { final: "n" }, // DSR 设备状态报告（含 6n 光标位置 → R）
  { prefix: "?", final: "n" }, // DEC 私有 DSR
  { prefix: "?", intermediates: "$", final: "p" }, // DECRQM 模式查询
];

// 字体自适应：缩放字号让 (cols×rows) 网格铺满手机容器。桌面独占 PTY 尺寸，手机纯镜像、
// 永不回改 PTY；故按服务端下发的真实 cols/rows 渲染，再调字号铺满（宽终端字会变小，符合镜像预期）。
function fitFont(term: Terminal, host: HTMLElement) {
  const { cols, rows } = term;
  const w = host.clientWidth;
  const h = host.clientHeight;
  if (!cols || !rows || w <= 0 || h <= 0) return;
  const fs = term.options.fontSize ?? 13;
  // 优先用 xterm 实测单元尺寸（与 FitAddon 同源），无则回退经验比例。
  const cell = (
    term as unknown as {
      _core?: { _renderService?: { dimensions?: { css?: { cell?: { width: number; height: number } } } } };
    }
  )._core?._renderService?.dimensions?.css?.cell;
  const cw = cell && cell.width > 0 ? cell.width : fs * 0.6;
  const ch = cell && cell.height > 0 ? cell.height : fs * 1.2;
  const scale = Math.min(w / (cols * cw), h / (rows * ch));
  const next = Math.max(5, Math.min(Math.round(fs * scale), 16));
  if (next !== fs) term.options.fontSize = next;
}

export const MobileTerminal = forwardRef<MobileTerminalHandle, Props>(function MobileTerminal({ conn, terminalId }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef(-1);
  const termRef = useRef<Terminal | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      sendKey: (data: string) => {
        if (slotRef.current >= 0) conn.sendInput(slotRef.current, new TextEncoder().encode(data));
      },
      focus: () => termRef.current?.focus(),
    }),
    [conn],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      allowProposedApi: true, // Unicode11Addon 需要
      convertEol: false,
      fontFamily: '"SF Mono", "Menlo", "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      theme: { background: "#1f1e1d", foreground: "#e5e2dc", cursor: "#d97757", selectionBackground: "#3a3631" },
      // 远程渲染器：禁 xterm 自身 reflow（内容由 Host ConPTY 整屏重绘驱动），避免双重重绘叠影。
      windowsPty: { backend: "conpty", buildNumber: 19045 },
    });
    termRef.current = term;
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = "11";
    for (const id of SUPPRESS_CSI) term.parser.registerCsiHandler(id, () => true);
    term.open(host);

    // 应用桌面下发的尺寸 + 字体自适应（永不 sendResize 回改 PTY）。
    const applySize = (cols: number, rows: number) => {
      if (cols > 0 && rows > 0 && (term.cols !== cols || term.rows !== rows)) term.resize(cols, rows);
      fitFont(term, host);
      requestAnimationFrame(() => fitFont(term, host)); // 字号变化后单元尺寸更新，再校准一次
    };

    let disposed = false;
    const dataSub = term.onData((data) => {
      if (slotRef.current >= 0) conn.sendInput(slotRef.current, new TextEncoder().encode(data));
    });

    conn
      .subscribe(
        terminalId,
        { mode: "visible-snapshot" },
        (bytes) => term.write(bytes),
        (cols, rows) => applySize(cols, rows), // 桌面 resize → 跟随其尺寸
      )
      .then((res) => {
        if (disposed) return;
        slotRef.current = res.slot;
        applySize(res.cols, res.rows); // 初始按桌面真实尺寸渲染
      })
      .catch((e) => term.write(`\r\n[订阅失败] ${String(e)}\r\n`));

    // 容器尺寸变化（旋转/软键盘）→ 只重算字号；网格仍是桌面尺寸，绝不 sendResize。
    const ro = new ResizeObserver(() => fitFont(term, host));
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      dataSub.dispose();
      void conn.unsubscribe(terminalId);
      term.dispose();
      termRef.current = null;
      slotRef.current = -1;
    };
  }, [conn, terminalId]);

  return <div ref={hostRef} className="term-host h-full w-full" />;
});
