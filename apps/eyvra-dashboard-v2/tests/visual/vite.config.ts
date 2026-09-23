import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve("src"),
      "next/link": path.resolve("tests/visual/link.tsx"),
      "next/navigation": path.resolve("tests/visual/navigation.ts"),
    },
  },
  server: { host: "127.0.0.1", port: 3013, strictPort: true },
});
