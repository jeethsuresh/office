import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { offlineShell } from "./pwa/plugin";
export default defineConfig({
  plugins: [react(), offlineShell()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4317", ws: true }, "/auth": { target: "http://127.0.0.1:4317" } },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
