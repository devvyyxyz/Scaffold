import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import pkg from "./package.json" with { type: "json" };

// Tauri spawns its own dev server and expects the frontend to be reachable
// on a fixed localhost port. We fix the port + enable the HMR overlay that
// works inside the Tauri webview.
const host = process.env.TAURI_DEV_HOST;

// Single source of truth for the app version, surfaced to the frontend as
// import.meta.env.VITE_APP_VERSION (e.g. in the About tab).
const APP_VERSION = pkg.version;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  // Vite options tailored for Tauri — see https://v2.tauri.app/reference/config
  clearScreen: false,
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
  },
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
