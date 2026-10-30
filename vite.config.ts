import { defineConfig } from "vite-plus";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  build: {
    chunkSizeWarningLimit: 700,
  },
  worker: { format: "es" },
});
