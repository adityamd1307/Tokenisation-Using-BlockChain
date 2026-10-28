import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ethereum: ["ethers"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/test/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
});
