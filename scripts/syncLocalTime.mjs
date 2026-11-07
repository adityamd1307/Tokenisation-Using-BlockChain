// Singapore-time requirements §3: catch up an idle demo without resetting its state.
import { FetchRequest, JsonRpcProvider } from "ethers";
const request = new FetchRequest("http://127.0.0.1:8545");
request.timeout = 5000;
const provider = new JsonRpcProvider(request, undefined, { cacheTimeout: -1 });
try {
  const [chain, client, before] = await Promise.all([
    provider.getNetwork(),
    provider.send("web3_clientVersion", []),
    provider.getBlock("latest"),
  ]);
  if (chain.chainId !== 31337n || !/hardhat/i.test(client))
    throw new Error("Only the local Hardhat demo is supported.");
  const now = Math.floor(Date.now() / 1000);
  if (before.timestamp > now + 5)
    throw new Error(
      `Chain is ${before.timestamp - now}s ahead of real time. Existing blocks cannot be moved backward. No state was reset. Wait for wall time to catch up, or explicitly start a fresh demo and redeploy.`,
    );
  if (before.timestamp < now) {
    await provider.send("evm_setNextBlockTimestamp", [now]);
    await provider.send("evm_mine", []);
  }
  await provider.send("evm_setAutomine", [true]);
  await provider.send("evm_setIntervalMining", [2000]);
  const after = await provider.getBlock("latest");
  console.log(
    JSON.stringify(
      {
        previousBlockUTC: new Date(before.timestamp * 1000).toISOString(),
        currentBlockSingapore: new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Singapore",
          dateStyle: "medium",
          timeStyle: "long",
        }).format(new Date(after.timestamp * 1000)),
        deltaSeconds: after.timestamp - Math.floor(Date.now() / 1000),
        intervalMiningMilliseconds: 2000,
        note: "Existing contracts, balances and deployment configuration preserved. Expiry and offering status now use current chain time.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  provider.destroy();
}
