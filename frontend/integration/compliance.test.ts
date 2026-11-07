import { afterAll, describe, it, expect } from "vitest";
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  keccak256,
  id,
  parseUnits,
} from "ethers";
import fs from "node:fs";
import { Blockchain } from "../src/services/blockchain";
import { Compliance } from "../src/services/compliance";
import { Subscriptions } from "../src/services/subscriptions";
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
describe("Regulated frontend services against real contracts", () => {
  it("creates regulated assets, administers credentials/policy, preflights, buys and claims with independent refunds", async () => {
    const signers = await provider.listAccounts(),
      [admin, issuer, attestor, investor, other] = await Promise.all(
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
          throw new Error("Wrong signer");
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
      const a = artifact(name),
        c = await new ContractFactory(a.abi, a.bytecode, signers[0]).deploy(
          ...args,
        );
      await c.waitForDeployment();
      return new Contract(await c.getAddress(), a.abi, signers[0]);
    }
    const factory = await deploy("RegulatedAssetFactory", [admin]),
      usd = await deploy("MockUSD", [admin]),
      sf = await deploy("SubscriptionFactory", [
        await factory.getAddress(),
        await usd.getAddress(),
      ]);
    const confirm = async (p: Promise<any>) => (await p).wait(),
      U = (v: string) => parseUnits(v, 6);
    await confirm(factory.setSubscriptionFactory(await sf.getAddress()));
    const block = await provider.getBlock("latest");
    const api = new Blockchain(provider, {
      chainId: 31337,
      regulatedFactory: true,
      AssetFactory: await factory.getAddress(),
      deployBlock: block!.number,
      deployBlockHash: block!.hash!,
      runtimeCodeHash: keccak256(
        await provider.getCode(await factory.getAddress()),
      ),
      SubscriptionFactory: await sf.getAddress(),
      MockUSD: await usd.getAddress(),
      subscriptionFactoryCodeHash: keccak256(
        await provider.getCode(await sf.getAddress()),
      ),
      mockUSDCodeHash: keccak256(
        await provider.getCode(await usd.getAddress()),
      ),
      subscriptionDeployBlock: block!.number,
    });
    const compliance = new Compliance(api),
      sub = new Subscriptions(api);
    await confirm(api.authorizeIssuer(wallet(admin), admin, issuer, true));
    await confirm(
      api.createAsset(
        wallet(issuer),
        issuer,
        {
          name: "Regulated campus",
          symbol: "CPT",
          description: "Synthetic",
          category: "0",
          supply: "10000",
          price: "0.001",
        },
        { maximum: "500", accredited: true },
      ),
    );
    const asset = await api.asset("0");
    expect(asset.identityRegistry).toBeTruthy();
    await confirm(
      compliance.trust(wallet(admin), admin, asset, attestor, true),
    );
    await confirm(
      compliance.updatePolicy(
        wallet(issuer),
        issuer,
        asset,
        "setCountryAllowed",
        "702",
        true,
      ),
    );
    const expiry = (await provider.getBlock("latest"))!.timestamp + 10000;
    const data = (who: string) => ({
      identityId: id(`synthetic:${who}`),
      country: "702",
      kycApproved: true,
      accredited: true,
      validUntil: new Date(expiry * 1000).toISOString(),
    });
    for (const who of [investor, other])
      await confirm(
        compliance.attest(
          wallet(attestor),
          attestor,
          asset,
          who,
          data(who),
          false,
        ),
      );
    expect((await compliance.identity(asset, investor)).status).toBe(0);
    expect((await compliance.state(asset, issuer)).policyAdmin).toBe(true);
    expect(
      (await compliance.check(asset, issuer, investor, "100")).reason,
    ).toBe(0);
    await confirm(api.approve(wallet(issuer), issuer, asset, "1000"));
    await confirm(api.deposit(wallet(issuer), issuer, asset, "1000"));
    await confirm(api.buy(wallet(investor), investor, asset, "100"));
    expect((await api.account(asset, investor)).balance).toBe(100n);
    await expect(
      api.buy(wallet(investor), investor, asset, "401"),
    ).rejects.toThrow("maximum wallet holdings");
    await confirm(
      api.transfer(wallet(investor), investor, asset, issuer, "100"),
    );
    const start = (await provider.getBlock("latest"))!.timestamp + 120,
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
    const at = await sf.offeringAt(0);
    await confirm(sub.action(wallet(issuer), issuer, at, "whitelistOffering"));
    await confirm(
      sub.action(wallet(issuer), issuer, at, "approveInventory", "1000"),
    );
    await confirm(sub.action(wallet(issuer), issuer, at, "deposit", "1000"));
    for (const who of [investor, other])
      await confirm(usd.mint(who, U("2000")));
    await provider.send("evm_setNextBlockTimestamp", [start]);
    await provider.send("evm_mine", []);
    for (const who of [investor, other]) {
      await confirm(sub.action(wallet(who), who, at, "approveUSD", "2000"));
      await confirm(sub.action(wallet(who), who, at, "commit", "2000"));
    }
    await provider.send("evm_setNextBlockTimestamp", [end]);
    await provider.send("evm_mine", []);
    await confirm(
      sub.action(wallet(investor), investor, at, "finalizeOffering"),
    );
    for (const who of [investor, other])
      await confirm(sub.action(wallet(who), who, at, "settleSubscription"));
    await confirm(compliance.revoke(wallet(admin), admin, asset, investor));
    await expect(
      sub.action(wallet(investor), investor, at, "claimTokens"),
    ).rejects.toThrow("Credential revoked");
    await confirm(sub.action(wallet(investor), investor, at, "withdrawRefund"));
    expect(await usd.balanceOf(investor)).toBe(U("1000"));
    await confirm(
      compliance.attest(
        wallet(attestor),
        attestor,
        asset,
        investor,
        data(investor),
        true,
      ),
    );
    await confirm(sub.action(wallet(investor), investor, at, "claimTokens"));
    expect((await api.account(asset, investor)).balance).toBe(500n);
    expect((await sub.get(at)).recoverable).toBe(0n);
    await confirm(
      api.createAsset(wallet(issuer), issuer, {
        name: "Legacy",
        symbol: "LEG",
        description: "",
        category: "0",
        supply: "10",
        price: "0.001",
      }),
    );
    expect((await api.asset("1")).identityRegistry).toBeUndefined();
  }, 60000);
});
