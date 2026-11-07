// Actual local contracts + production frontend services + an EIP-1193 RPC adapter.
// This is not a MetaMask/browser-signing test. No private keys are read or stored.
import { afterAll, describe, expect, it } from "vitest";
import {
  ContractFactory,
  JsonRpcProvider,
  keccak256,
  parseEther,
} from "ethers";
import fs from "node:fs";
import { Blockchain } from "../src/services/blockchain";
import { assetHistory } from "../src/services/history";
import { confirmTransaction } from "../src/services/transactions";
import type { WalletProvider } from "../src/types";
const provider = new JsonRpcProvider(
  process.env.INTEGRATION_RPC_URL || "http://127.0.0.1:18545",
  undefined,
  {
    cacheTimeout: -1,
    pollingInterval: 50,
  },
);
afterAll(() => provider.destroy());
describe("Local frontend-service integration", () => {
  it("completes administration → two assets → funding → purchase → transfer → withdrawal → closure → recovery", async () => {
    expect((await provider.getNetwork()).chainId).toBe(31337n);
    const signers = await provider.listAccounts();
    const [admin, issuer, investor1, investor2, unapproved] = await Promise.all(
      signers.slice(0, 5).map((signer) => signer.getAddress()),
    );
    function wallet(account: string): WalletProvider {
      return {
        request: async ({ method, params }) => {
          if (method === "eth_accounts" || method === "eth_requestAccounts")
            return [account];
          if (
            method === "eth_sendTransaction" &&
            (params as any)[0].from.toLowerCase() !== account.toLowerCase()
          )
            throw new Error("Unexpected signing account");
          return provider.send(method, params || []);
        },
      };
    }
    const artifact = JSON.parse(
      fs.readFileSync(
        new URL(
          "../../artifacts/contracts/AssetFactory.sol/AssetFactory.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const deployed = await new ContractFactory(
      artifact.abi,
      artifact.bytecode,
      signers[0],
    ).deploy(admin);
    const receipt = await deployed.deploymentTransaction()!.wait();
    const factory = await deployed.getAddress();
    const api = new Blockchain(provider, {
      chainId: 31337,
      AssetFactory: factory,
      deployBlock: receipt!.blockNumber,
      deployBlockHash: (await provider.getBlock(receipt!.blockNumber))!.hash!,
      runtimeCodeHash: keccak256(await provider.getCode(factory)),
    });
    const confirm = async (tx: Promise<any>) =>
      confirmTransaction(await tx, () => {});
    await api.ready();
    expect(await api.assets()).toEqual([]);
    expect(await api.roles(admin)).toEqual({ admin: true, issuer: false });
    await confirm(api.authorizeIssuer(wallet(admin), admin, issuer, true));
    expect(await api.issuerStatus(issuer)).toBe(true);
    await confirm(
      api.createAsset(wallet(issuer), issuer, {
        name: "Campus Property Token",
        symbol: "CPT",
        description: "Integration fixture",
        category: "0",
        supply: "10000",
        price: "0.001",
      }),
    );
    const cpt = await api.asset("0");
    expect(cpt.totalSupply).toBe(10000n);
    expect(cpt.inventory).toBe(0n);
    await expect(
      api.deposit(wallet(issuer), issuer, cpt, "5000"),
    ).rejects.toThrow("Whitelist both");
    await confirm(api.whitelist(wallet(issuer), issuer, cpt, cpt.sale, true));
    await expect(
      api.deposit(wallet(issuer), issuer, cpt, "5000"),
    ).rejects.toThrow("Approve sufficient");
    await confirm(api.approve(wallet(issuer), issuer, cpt, "5000"));
    expect((await api.account(cpt, issuer)).allowance).toBe(5000n);
    await confirm(api.deposit(wallet(issuer), issuer, cpt, "5000"));
    expect((await api.asset("0")).inventory).toBe(5000n);
    for (const account of [investor1, investor2])
      await confirm(api.whitelist(wallet(issuer), issuer, cpt, account, true));
    await confirm(api.buy(wallet(investor1), investor1, cpt, "100"));
    expect((await api.account(cpt, investor1)).balance).toBe(100n);
    expect((await api.asset("0")).inventory).toBe(4900n);
    expect((await api.asset("0")).proceeds).toBe(parseEther("0.1"));
    // Phase 6 exact two-buyer scenario; exercise the production service for both.
    await confirm(api.buy(wallet(investor2), investor2, cpt, "50"));
    expect((await api.asset("0")).proceeds).toBe(parseEther("0.15"));
    await confirm(
      api.transfer(wallet(investor1), investor1, cpt, investor2, "20"),
    );
    expect((await api.account(cpt, investor1)).balance).toBe(80n);
    expect((await api.account(cpt, investor2)).balance).toBe(70n);
    await expect(
      api.buy(wallet(unapproved), unapproved, cpt, "1"),
    ).rejects.toThrow("not approved");
    // Also bypass UI/service preflight to prove the contracts remain authoritative.
    await expect(
      api.sale(cpt, signers[4]).buyTokens(1n, { value: cpt.price }),
    ).rejects.toThrow();
    await expect(
      api.token(cpt, signers[2]).transfer(unapproved, 1n),
    ).rejects.toThrow();
    expect((await api.asset("0")).inventory).toBe(4850n);
    expect((await api.account(cpt, investor1)).balance).toBe(80n);
    await confirm(
      api.manageSale(wallet(issuer), issuer, cpt, "withdrawProceeds"),
    );
    expect((await api.asset("0")).proceeds).toBe(0n);
    expect((await api.asset("0")).saleEth).toBe(0n);
    await confirm(api.manageSale(wallet(issuer), issuer, cpt, "closeSale"));
    expect((await api.asset("0")).closed).toBe(true);
    await expect(
      api.buy(wallet(investor1), investor1, cpt, "1"),
    ).rejects.toThrow("closed");
    await confirm(
      api.manageSale(wallet(issuer), issuer, cpt, "recoverUnsoldTokens"),
    );
    expect((await api.asset("0")).inventory).toBe(0n);
    expect((await api.account(cpt, issuer)).balance).toBe(9850n);
    await confirm(
      api.createAsset(wallet(issuer), issuer, {
        name: "Digital Licensing Token",
        symbol: "DLT",
        description: "Separate whitelist",
        category: "1",
        supply: "5000",
        price: "0.002",
      }),
    );
    const dlt = await api.asset("1");
    expect(await api.eligibility(dlt, investor1)).toBe(false);
    await confirm(api.whitelist(wallet(issuer), issuer, dlt, dlt.sale, true));
    await confirm(api.whitelist(wallet(issuer), issuer, dlt, investor1, true));
    await confirm(api.approve(wallet(issuer), issuer, dlt, "1000"));
    await confirm(api.deposit(wallet(issuer), issuer, dlt, "1000"));
    await confirm(api.buy(wallet(investor1), investor1, dlt, "50"));
    expect((await api.assets()).map((a) => a.symbol)).toEqual(["CPT", "DLT"]);
    expect(
      (await api.holdings(await api.assets(), investor1)).map((h) => h.balance),
    ).toEqual([80n, 50n]);
    expect(await api.eligibility(dlt, investor2)).toBe(false);
    const history = await assetHistory(api, cpt, investor1);
    expect(history.filter((row) => row.type === "Purchase")).toHaveLength(1);
    expect(history.filter((row) => row.type === "Transfer")).toHaveLength(1);
    expect(history.find((row) => row.type === "Purchase")?.paid).toBe(
      parseEther("0.1"),
    );
    expect(
      history.every(
        (row) => !!row.timestamp && row.block >= receipt!.blockNumber,
      ),
    ).toBe(true);
    const allHistory = await assetHistory(api, cpt);
    expect(allHistory.some((row) => row.type === "Asset created")).toBe(true);
    expect(allHistory.some((row) => row.type === "Offering closed")).toBe(true);
    await confirm(api.authorizeIssuer(wallet(admin), admin, issuer, false));
    expect(await api.issuerStatus(issuer)).toBe(false);
    await expect(
      api.createAsset(wallet(issuer), issuer, {
        name: "Blocked",
        symbol: "NO",
        description: "",
        category: "0",
        supply: "1",
        price: "1",
      }),
    ).rejects.toThrow("not authorised");
    await confirm(api.whitelist(wallet(issuer), issuer, dlt, investor1, false));
    expect(await api.eligibility(dlt, investor1)).toBe(false);
    expect((await api.account(dlt, investor1)).balance).toBe(50n);
    // D5 (AUD-013): recover the revoked holding, then check real-log history types it once.
    await confirm(
      api.token(dlt, signers[1]).forcedTransfer(investor1, issuer, 50n),
    );
    expect((await api.account(dlt, investor1)).balance).toBe(0n);
    const dltHistory = await assetHistory(api, dlt, investor1);
    expect(dltHistory.filter((row) => row.type === "Forced transfer")).toEqual([
      expect.objectContaining({ from: investor1, to: issuer, quantity: 50n }),
    ]);
    expect(dltHistory.filter((row) => row.type === "Transfer")).toHaveLength(0);
    await confirm(api.token(cpt, signers[1]).pause());
    await expect(
      api.token(cpt, signers[2]).transfer(investor2, 1n),
    ).rejects.toThrow();
    expect((await api.account(cpt, investor1)).balance).toBe(80n);
    console.log(
      "Verified local lifecycle: CPT 80 / 70 investor balances; 0.15 ETH withdrawn; 4,850 unsold recovered; issuer 9,850 CPT; DLT holding 50 force-transferred after revocation; paused CPT blocks transfers; independent eligibility; no duplicate purchase or forced-transfer event.",
    );
  });
});
