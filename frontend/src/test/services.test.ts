import { beforeEach, describe, expect, it, vi } from "vitest";
import { JsonRpcProvider, parseEther } from "ethers";
import { Blockchain, COMPLIANCE_ROLE } from "../services/blockchain";
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
      "pause",
      "unpause",
      "forcedTransfer",
      "grantRole",
      "revokeRole",
    ].map((name) => [name, vi.fn().mockResolvedValue(mockTransaction())]),
  );
  methods.balanceOf = vi.fn().mockResolvedValue(40n);
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
// spec-v1 §5 "D5 functions" and Phase 2 role delegation.
describe("Token controls", () => {
  const admin = { ...accountState, tokenAdmin: true };
  it.each([
    [true, "pause"],
    [false, "unpause"],
  ] as const)(
    "setPaused(%s) calls %s for a token admin",
    async (paused, fn) => {
      vi.mocked(api.account).mockResolvedValue(admin);
      vi.mocked(api.asset).mockResolvedValue({ ...asset, paused: !paused });
      await api.setPaused(wallet, ISSUER, asset, paused);
      expect(methods[fn]).toHaveBeenCalledOnce();
    },
  );
  it("refuses to pause without DEFAULT_ADMIN_ROLE", async () => {
    await expect(api.setPaused(wallet, INVESTOR, asset, true)).rejects.toThrow(
      "token admin",
    );
    expect(methods.pause).not.toHaveBeenCalled();
  });
  it("refuses to pause an already paused asset", async () => {
    vi.mocked(api.account).mockResolvedValue(admin);
    vi.mocked(api.asset).mockResolvedValue({ ...asset, paused: true });
    await expect(api.setPaused(wallet, ISSUER, asset, true)).rejects.toThrow(
      "already paused",
    );
    expect(methods.pause).not.toHaveBeenCalled();
  });
  it("forces a transfer from a revoked holder to a verified recipient", async () => {
    vi.mocked(api.account).mockResolvedValue(admin);
    vi.mocked(api.eligibility).mockImplementation(
      async (_asset, who) => who === RECIPIENT,
    );
    await api.forcedTransfer(wallet, ISSUER, asset, INVESTOR, RECIPIENT, "40");
    expect(methods.forcedTransfer).toHaveBeenCalledWith(
      INVESTOR,
      RECIPIENT,
      40n,
    );
  });
  it.each([
    [
      "the caller is not a token admin",
      accountState,
      [RECIPIENT],
      "40",
      "token admin",
    ],
    [
      "the source is still verified",
      admin,
      [INVESTOR, RECIPIENT],
      "40",
      "still verified",
    ],
    ["the recipient is not verified", admin, [], "40", "recipient is not"],
    [
      "the amount exceeds the balance",
      admin,
      [RECIPIENT],
      "41",
      "holds only 40",
    ],
  ])(
    "blocks a forced transfer when %s",
    async (_n, state, verified, amount, message) => {
      vi.mocked(api.account).mockResolvedValue(state);
      vi.mocked(api.eligibility).mockImplementation(async (_asset, who) =>
        verified.includes(who),
      );
      await expect(
        api.forcedTransfer(wallet, ISSUER, asset, INVESTOR, RECIPIENT, amount),
      ).rejects.toThrow(message);
      expect(methods.forcedTransfer).not.toHaveBeenCalled();
    },
  );
  it.each([
    [true, "grantRole"],
    [false, "revokeRole"],
  ] as const)(
    "setComplianceRole(%s) calls %s with COMPLIANCE_ROLE",
    async (grant, fn) => {
      vi.mocked(api.account).mockResolvedValue(admin);
      await api.setComplianceRole(wallet, ISSUER, asset, RECIPIENT, grant);
      expect(methods[fn]).toHaveBeenCalledWith(COMPLIANCE_ROLE, RECIPIENT);
    },
  );
  it("refuses role changes without DEFAULT_ADMIN_ROLE", async () => {
    await expect(
      api.setComplianceRole(wallet, INVESTOR, asset, RECIPIENT, true),
    ).rejects.toThrow("token admin");
    expect(methods.grantRole).not.toHaveBeenCalled();
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
