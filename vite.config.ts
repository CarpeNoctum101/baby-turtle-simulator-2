import { defineConfig } from "vitest/config";

export default defineConfig({
  // Babylon registers its shaders when those files load. Prebundling can split
  // that registration into a second copy, so the scene draws only the sky color.
  optimizeDeps: {
    exclude: ["@babylonjs/core"],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
