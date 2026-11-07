import { defineConfig } from "@playwright/test";

// End-to-end run against a local Hardhat node (npm run node, deploy:local,
// demo:local). Specs run in file order on one worker because they share chain state.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5173", viewport: { width: 1440, height: 900 } },
  webServer: {
    command: "npx vite --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
