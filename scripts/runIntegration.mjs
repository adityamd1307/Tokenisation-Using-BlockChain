// Singapore-time requirements §4: never time-travel the user's demo node.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { FetchRequest, JsonRpcProvider } from "ethers";
const host = "127.0.0.1";
const server = createServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, host, resolve);
});
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const url = `http://${host}:${port}`;
// Suppress node output: Hardhat's startup includes development private keys.
const node = spawn(
  process.execPath,
  [
    "node_modules/hardhat/dist/src/cli.js",
    "node",
    "--network",
    "hardhatMainnet",
    "--hostname",
    host,
    "--port",
    String(port),
  ],
  { stdio: "ignore" },
);
const nodeExit = once(node, "exit");
let tests;
const stop = () => {
  tests?.kill("SIGTERM");
  node.kill("SIGTERM");
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
const request = new FetchRequest(url);
request.timeout = 1000;
const provider = new JsonRpcProvider(request, 31337, {
  staticNetwork: true,
  cacheTimeout: -1,
});
try {
  const deadline = Date.now() + 30000;
  for (;;) {
    if (node.exitCode !== null || node.signalCode !== null)
      throw new Error(
        "Isolated integration node exited before becoming ready.",
      );
    try {
      await provider.getBlockNumber();
      break;
    } catch {
      if (Date.now() > deadline)
        throw new Error(
          "Isolated integration node did not start within 30 seconds.",
        );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.log(
    `Integration tests use an isolated node at ${url}; the demo chain is untouched.`,
  );
  tests = spawn(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "vite.integration.config.ts",
    ],
    {
      cwd: "frontend",
      stdio: "inherit",
      env: { ...process.env, INTEGRATION_RPC_URL: url },
    },
  );
  const [code] = await once(tests, "exit");
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  provider.destroy();
  stop();
  await nodeExit;
}
