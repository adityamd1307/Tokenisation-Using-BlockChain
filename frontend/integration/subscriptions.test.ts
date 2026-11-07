import { afterAll, describe, expect, it } from "vitest";
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  keccak256,
  parseUnits,
} from "ethers";
import fs from "node:fs";
import { Blockchain } from "../src/services/blockchain";
import { Subscriptions } from "../src/services/subscriptions";
import { confirmTransaction } from "../src/services/transactions";
import type { WalletProvider } from "../src/types";
const provider = new JsonRpcProvider(
  process.env.INTEGRATION_RPC_URL || "http://127.0.0.1:18545",
  undefined,
  {
    cacheTimeout: -1,
    pollingInterval: 30,
  },
);
afterAll(() => provider.destroy());
describe("Subscription frontend services against real local contracts", () => {
  it("creates, funds, oversubscribes, finalises, settles, refunds, claims and preserves direct sales", async () => {
    expect((await provider.getNetwork()).chainId).toBe(31337n);
    const signers = await provider.listAccounts(),
      [admin, issuer, a, b, c] = await Promise.all(
        signers.slice(0, 5).map((s) => s.getAddress()),
      );
    const wallet = (account: string): WalletProvider => ({
      request: async ({ method, params }) => {
        if (method === "eth_accounts" || method === "eth_requestAccounts")
          return [account];
        if (
          method === "eth_sendTransaction" &&
          (params as any)[0].from.toLowerCase() !== account.toLowerCase()
        )
          throw new Error("Unexpected signer");
        return provider.send(method, params || []);
      },
    });
    const artifact = (name: string) =>
      JSON.parse(
        fs.readFileSync(
          new URL(
            `../../artifacts/contracts/${name}.sol/${name}.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      );
    async function deploy(name: string, args: any[]) {
      const art = artifact(name);
      const base = await new ContractFactory(
        art.abi,
        art.bytecode,
        signers[0],
      ).deploy(...args);
      await base.waitForDeployment();
      return new Contract(await base.getAddress(), art.abi, signers[0]);
    }
    const f = await deploy("AssetFactory", [admin]),
      usd = await deploy("MockUSD", [admin]);
    const registry = await deploy("SubscriptionFactory", [
      await f.getAddress(),
      await usd.getAddress(),
    ]);
    const block = await provider.getBlock("latest");
    const api = new Blockchain(provider, {
      chainId: 31337,
      AssetFactory: await f.getAddress(),
      deployBlock: block!.number,
      deployBlockHash: block!.hash!,
      runtimeCodeHash: keccak256(await provider.getCode(await f.getAddress())),
      SubscriptionFactory: await registry.getAddress(),
      MockUSD: await usd.getAddress(),
      subscriptionFactoryCodeHash: keccak256(
        await provider.getCode(await registry.getAddress()),
      ),
      mockUSDCodeHash: keccak256(
        await provider.getCode(await usd.getAddress()),
      ),
      subscriptionDeployBlock: block!.number,
    });
    const sub = new Subscriptions(api),
      confirm = async (p: Promise<any>) =>
        confirmTransaction(await p, () => {}),
      U = (x: string) => parseUnits(x, 6);
    await sub.ready();
    await confirm(api.authorizeIssuer(wallet(admin), admin, issuer, true));
    await confirm(
      api.createAsset(wallet(issuer), issuer, {
        name: "Campus Property Token",
        symbol: "CPT",
        description: "Subscription integration",
        category: "0",
        supply: "10000",
        price: "0.001",
      }),
    );
    const asset = await api.asset("0");
    for (const who of [a, b, c]) {
      await confirm(api.whitelist(wallet(issuer), issuer, asset, who, true));
      await confirm(usd.mint(who, U("10000")));
    }
    async function create() {
      const latest = await provider.getBlock("latest"),
        start = latest!.timestamp + 120,
        end = start + 180;
      await confirm(
        sub.create(wallet(issuer), issuer, asset, {
          supply: "1000",
          price: "2",
          softCap: "1200",
          start: new Date(start * 1000).toISOString(),
          end: new Date(end * 1000).toISOString(),
        }),
      );
      const at = await registry.offeringAt(
        (await registry.offeringCount()) - 1n,
      );
      await confirm(
        sub.action(wallet(issuer), issuer, at, "whitelistOffering"),
      );
      await confirm(
        sub.action(wallet(issuer), issuer, at, "approveInventory", "1000"),
      );
      await confirm(sub.action(wallet(issuer), issuer, at, "deposit", "1000"));
      expect((await sub.get(at)).deposited).toBe(1000n);
      await provider.send("evm_setNextBlockTimestamp", [start]);
      await provider.send("evm_mine", []);
      return { at, end };
    }
    const { at, end } = await create();
    for (const [who, amount] of [
      [a, "1800"],
      [b, "1400"],
      [c, "800"],
    ]) {
      await confirm(sub.action(wallet(who), who, at, "approveUSD", amount));
      expect(
        (await sub.account(await sub.get(at), asset, who)).commitment,
      ).toBe(0n);
      await confirm(sub.action(wallet(who), who, at, "commit", amount));
    }
    expect((await sub.get(at)).demand).toBe(U("4000"));
    await provider.send("evm_setNextBlockTimestamp", [end]);
    await provider.send("evm_mine", []);
    await confirm(sub.action(wallet(a), a, at, "finalizeOffering"));
    expect((await sub.get(at)).state).toBe(3);
    for (const [who, allocation, refund] of [
      [a, 450n, "900"],
      [b, 350n, "700"],
      [c, 200n, "400"],
    ] as const) {
      let account = await sub.account(await sub.get(at), asset, who);
      expect(account.allocation).toBe(allocation);
      expect(account.refund).toBe(U(refund));
      await confirm(sub.action(wallet(who), who, at, "settleSubscription"));
      // Withdraw issuer proceeds BEFORE refunds to exercise protected liabilities.
      await confirm(sub.action(wallet(issuer), issuer, at, "withdrawProceeds"));
      await confirm(sub.action(wallet(who), who, at, "withdrawRefund"));
      await confirm(sub.action(wallet(who), who, at, "claimTokens"));
      account = await sub.account(await sub.get(at), asset, who);
      expect(account.claimed).toBe(true);
      expect(account.refund).toBe(0n);
      expect(account.assetBalance).toBe(allocation);
    }
    expect(await usd.balanceOf(issuer)).toBe(U("2000"));
    const history = await sub.history(await sub.get(at), asset);
    expect(
      history.rows.filter((r) => r.type === "Subscription committed"),
    ).toHaveLength(3);
    expect(
      history.rows.filter((r) => r.type === "Refund withdrawn"),
    ).toHaveLength(3);
    expect(
      history.rows.filter((r) => r.type === "Tokens claimed"),
    ).toHaveLength(3);
    expect(
      history.rows.filter((r) => /approval|purchase/i.test(r.type)),
    ).toHaveLength(0);
    expect(
      history.rows.find((r) => r.type === "Refund withdrawn")!.currency,
    ).toBe("mUSD");
    const failed = await create();
    await confirm(sub.action(wallet(a), a, failed.at, "approveUSD", "700"));
    await confirm(sub.action(wallet(a), a, failed.at, "commit", "700"));
    await provider.send("evm_setNextBlockTimestamp", [failed.end]);
    await provider.send("evm_mine", []);
    await confirm(sub.action(wallet(a), a, failed.at, "finalizeOffering"));
    expect((await sub.get(failed.at)).state).toBe(4);
    await confirm(api.whitelist(wallet(issuer), issuer, asset, a, false));
    await confirm(sub.action(wallet(a), a, failed.at, "settleSubscription"));
    await confirm(sub.action(wallet(a), a, failed.at, "withdrawRefund"));
    await confirm(
      sub.action(wallet(issuer), issuer, failed.at, "recoverUnsoldTokens"),
    );
    expect(
      (await sub.account(await sub.get(failed.at), asset, a)).balance,
    ).toBe(U("9100"));
    await confirm(api.whitelist(wallet(issuer), issuer, asset, a, true));
    await confirm(
      api.whitelist(wallet(issuer), issuer, asset, asset.sale, true),
    );
    await confirm(api.approve(wallet(issuer), issuer, asset, "100"));
    await confirm(api.deposit(wallet(issuer), issuer, asset, "100"));
    await confirm(api.buy(wallet(a), a, asset, "10"));
    expect((await api.account(asset, a)).balance).toBe(460n);
    expect((await sub.get(at)).recognized).toBe(U("2000"));
    expect((await sub.list()).items).toHaveLength(2);
    expect((await sub.list(0, 1)).hasMore).toBe(true);
    expect((await sub.list(1, 1)).hasMore).toBe(false);
    const mismatch: WalletProvider = {
      request: async (request) =>
        request.method === "eth_getCode" ? "0x" : wallet(a).request(request),
    };
    await expect(sub.signer(mismatch, a)).rejects.toThrow("does not match");
    await expect(sub.get(asset.sale)).rejects.toThrow("not registered");
  });
});
