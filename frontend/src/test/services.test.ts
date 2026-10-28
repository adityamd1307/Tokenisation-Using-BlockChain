import { beforeEach, describe, expect, it, vi } from "vitest";
import { JsonRpcProvider, parseEther } from "ethers";
import { Blockchain } from "../services/blockchain";
import { confirmTransaction } from "../services/transactions";
import {
  asset,
  accountState,
  FACTORY,
  INVESTOR,
  ISSUER,
  MockWallet,
  mockTransaction,
  RECIPIENT,
  SALE,
} from "./fixtures";
const wallet = new MockWallet();
let api: Blockchain;
let methods: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  const provider = new JsonRpcProvider();
  api = new Blockchain(provider, {
    chainId: 31337,
    AssetFactory: FACTORY,
    deployBlock: 1,
  });
  methods = Object.fromEntries(
    [
      "authorizeIssuer",
      "revokeIssuer",
      "createAsset",
      "approve",
      "allocate",
      "buyTokens",
      "transfer",
      "withdrawProceeds",
      "closeSale",
      "recoverUnsoldTokens",
      "sweepExcessETH",
      "setWhitelisted",
    ].map((name) => [name, vi.fn().mockResolvedValue(mockTransaction())]),
  );
  vi.spyOn(api, "factory").mockReturnValue(methods as any);
  vi.spyOn(api, "token").mockReturnValue(methods as any);
  vi.spyOn(api, "sale").mockReturnValue(methods as any);
  vi.spyOn(api, "signer").mockResolvedValue({} as any);
  vi.spyOn(api, "asset").mockResolvedValue(asset);
  vi.spyOn(api, "account").mockResolvedValue(accountState);
  vi.spyOn(api, "eligibility").mockResolvedValue(true);
  vi.spyOn(api, "roles").mockResolvedValue({ admin: true, issuer: true });
  vi.spyOn(provider, "getBalance").mockResolvedValue(parseEther("1"));
});
describe("Actual ABI write methods and preflight checks", () => {
  it("passes the exact payable value to buyTokens", async () => {
    await api.buy(wallet, INVESTOR, asset, "100");
    expect(methods.buyTokens).toHaveBeenCalledWith(100n, {
      value: parseEther("0.1"),
    });
  });
  it.each([
    ["non-whitelisted buyer", { eligible: false }, {}, "not approved"],
    ["unapproved sale", { saleEligible: false }, {}, "not whitelisted"],
    ["closed offering", {}, { closed: true }, "closed"],
    ["insufficient inventory", {}, { inventory: 10n }, "inventory"],
  ])("blocks %s before sending", async (_name, changes, sale, message) => {
    vi.mocked(api.account).mockResolvedValue({ ...accountState, ...changes });
    vi.mocked(api.asset).mockResolvedValue({ ...asset, ...sale });
    await expect(api.buy(wallet, INVESTOR, asset, "100")).rejects.toThrow(
      String(message),
    );
    expect(methods.buyTokens).not.toHaveBeenCalled();
  });
  it("blocks insufficient ETH", async () => {
    vi.mocked(api.provider.getBalance).mockResolvedValue(1n);
    await expect(api.buy(wallet, INVESTOR, asset, "100")).rejects.toThrow(
      "Insufficient ETH",
    );
  });
  it("calls createAsset with the compiled ABI’s argument order", async () => {
    await api.createAsset(wallet, ISSUER, {
      name: "CPT",
      symbol: "CPT",
      description: "Campus",
      category: "0",
      supply: "10000",
      price: "0.001",
    });
    expect(methods.createAsset).toHaveBeenCalledWith(
      "CPT",
      "CPT",
      "Campus",
      0,
      10000n,
      parseEther("0.001"),
    );
  });
  it("checks issuer authority before creation", async () => {
    vi.mocked(api.roles).mockResolvedValue({ admin: false, issuer: false });
    await expect(
      api.createAsset(wallet, INVESTOR, {
        name: "CPT",
        symbol: "CPT",
        description: "",
        category: "0",
        supply: "10000",
        price: "0.001",
      }),
    ).rejects.toThrow("not authorised");
    expect(methods.createAsset).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "uses the actual issuer authorisation API (%s)",
    async (approved) => {
      await api.authorizeIssuer(wallet, INVESTOR, ISSUER, approved);
      expect(
        approved ? methods.authorizeIssuer : methods.revokeIssuer,
      ).toHaveBeenCalledWith(ISSUER);
    },
  );
  it.each([true, false])(
    "updates the asset-specific whitelist (%s)",
    async (approved) => {
      vi.mocked(api.account).mockResolvedValue({
        ...accountState,
        compliance: true,
      });
      await api.whitelist(wallet, ISSUER, asset, INVESTOR, approved);
      expect(methods.setWhitelisted).toHaveBeenCalledWith(INVESTOR, approved);
    },
  );
  it("does not infer compliance permission from issuer ownership", async () => {
    await expect(
      api.whitelist(wallet, ISSUER, asset, INVESTOR, true),
    ).rejects.toThrow("compliance role");
  });
  it("approves exactly the requested allowance without depositing", async () => {
    await api.approve(wallet, ISSUER, asset, "50");
    expect(methods.approve).toHaveBeenCalledWith(SALE, 50n);
    expect(methods.allocate).not.toHaveBeenCalled();
  });
  it("blocks deposit on insufficient allowance", async () => {
    await expect(api.deposit(wallet, ISSUER, asset, "50")).rejects.toThrow(
      "Approve sufficient",
    );
    expect(methods.allocate).not.toHaveBeenCalled();
  });
  it("deposits through allocate when allowance is sufficient", async () => {
    vi.mocked(api.account).mockResolvedValue({
      ...accountState,
      allowance: 50n,
    });
    await api.deposit(wallet, ISSUER, asset, "50");
    expect(methods.allocate).toHaveBeenCalledWith(50n);
  });
  it("blocks deposits if either endpoint is not whitelisted", async () => {
    vi.mocked(api.account).mockResolvedValue({
      ...accountState,
      saleEligible: false,
      allowance: 100n,
    });
    await expect(api.deposit(wallet, ISSUER, asset, "50")).rejects.toThrow(
      "Whitelist both",
    );
  });
  it("transfers to an eligible recipient", async () => {
    await api.transfer(wallet, INVESTOR, asset, RECIPIENT, "20");
    expect(methods.transfer).toHaveBeenCalledWith(RECIPIENT, 20n);
  });
  it("blocks a non-approved recipient", async () => {
    vi.mocked(api.eligibility).mockResolvedValue(false);
    await expect(
      api.transfer(wallet, INVESTOR, asset, RECIPIENT, "20"),
    ).rejects.toThrow("recipient is not authorised");
    expect(methods.transfer).not.toHaveBeenCalled();
  });
  it("blocks insufficient transfer balance", async () => {
    await expect(
      api.transfer(wallet, INVESTOR, asset, RECIPIENT, "101"),
    ).rejects.toThrow("Insufficient token balance");
  });
  it.each([
    "withdrawProceeds",
    "closeSale",
    "recoverUnsoldTokens",
    "sweepExcessETH",
  ] as const)("calls %s only for the issuer", async (operation) => {
    await api.manageSale(wallet, ISSUER, asset, operation);
    expect(methods[operation]).toHaveBeenCalledOnce();
    await expect(
      api.manageSale(wallet, INVESTOR, asset, operation),
    ).rejects.toThrow("Only this asset");
  });
});
describe("Receipt handling", () => {
  it("waits for status 1 and reports submitted, pending and confirmed", async () => {
    const tx = mockTransaction();
    const status = vi.fn();
    await confirmTransaction(tx as any, status);
    expect(tx.wait).toHaveBeenCalledWith(1, 120000);
    expect(status.mock.calls.map((c) => c[0])).toEqual([
      "submitted",
      "pending",
      "confirmed",
    ]);
  });
  it("never reports success for a status-0 receipt", async () => {
    const status = vi.fn();
    await expect(
      confirmTransaction(mockTransaction(0) as any, status),
    ).rejects.toThrow("reverted");
    expect(status.mock.calls.some((c) => c[0] === "confirmed")).toBe(false);
  });
  it("accepts a successfully repriced replacement", async () => {
    const tx = mockTransaction();
    tx.wait.mockRejectedValue({
      code: "TRANSACTION_REPLACED",
      reason: "repriced",
      cancelled: false,
      receipt: { status: 1, hash: "replacement" },
    });
    const status = vi.fn();
    await confirmTransaction(tx as any, status);
    expect(status).toHaveBeenLastCalledWith("confirmed", "replacement");
  });
  it("does not treat a cancelled replacement as success", async () => {
    const tx = mockTransaction();
    tx.wait.mockRejectedValue({
      code: "TRANSACTION_REPLACED",
      reason: "cancelled",
      cancelled: true,
    });
    await expect(confirmTransaction(tx as any, vi.fn())).rejects.toMatchObject({
      cancelled: true,
    });
  });
});
