import { FitAddon } from "@xterm/addon-fit";
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
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = "11";
    for (const id of SUPPRESS_CSI) term.parser.registerCsiHandler(id, () => true);

    term.open(host);
    fit.fit();

    let disposed = false;
    const dataSub = term.onData((data) => {
      if (slotRef.current >= 0) conn.sendInput(slotRef.current, new TextEncoder().encode(data));
    });

    conn
      .subscribe(terminalId, { mode: "visible-snapshot" }, (bytes) => term.write(bytes))
      .then((res) => {
        if (disposed) return;
        slotRef.current = res.slot;
        conn.sendResize(res.slot, term.cols, term.rows);
      })
      .catch((e) => term.write(`\r\n[订阅失败] ${String(e)}\r\n`));

    const ro = new ResizeObserver(() => {
      fit.fit();
      if (slotRef.current >= 0) conn.sendResize(slotRef.current, term.cols, term.rows);
    });
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      dataSub.dispose();
      term.dispose();
      termRef.current = null;
      slotRef.current = -1;
    };
  }, [conn, terminalId]);

  return <div ref={hostRef} className="term-host h-full w-full" />;
});
