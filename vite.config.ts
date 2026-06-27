import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// @htybox/link 以 TS 源码消费（无构建产物，main=src/index.ts）：alias 指向源码，
// 并放开 server.fs 让 vite 能读取项目根之外的 ../HtyBox_link。
// 端口用 1430，避开桌面 HtyBox 的 1420（同机调试时两者可能并存）。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@htybox/link": fileURLToPath(new URL("../HtyBox_link/ts/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 1430,
    strictPort: true,
    host: true, // 暴露到 LAN，便于真机/同网浏览器访问 dev server
    fs: {
      // 允许读取上一级（含 ../HtyBox_link/ts/src 协议库源码）
      allow: [".."],
    },
  },
});
