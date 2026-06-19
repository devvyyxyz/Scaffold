import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Tauri spawns its own dev server and expects the frontend to be reachable
// on a fixed localhost port. We fix the port + enable the HMR overlay that
// works inside the Tauri webview.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  // Vite options tailored for Tauri — see https://v2.tauri.app/reference/config
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Don't watch the Rust source from the Vite side — Tauri handles that.
      ignored: ["**/src-tauri/**"],
    },
  },
}));
