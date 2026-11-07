import { describe, expect, it, vi } from "vitest";
import { JsonRpcProvider } from "ethers";
import { Blockchain } from "../services/blockchain";
import { assetHistory } from "../services/history";
import {
  asset,
  FACTORY,
  HASH,
  INVESTOR,
  ISSUER,
  RECIPIENT,
  SALE,
} from "./fixtures";
function fixture() {
  const provider = new JsonRpcProvider();
  vi.spyOn(provider, "getBlockNumber").mockResolvedValue(4100);
  vi.spyOn(provider, "getBlock").mockResolvedValue({
    timestamp: 1700000000,
  } as any);
  const api = new Blockchain(provider, {
    AssetFactory: FACTORY,
    chainId: 31337,
    deployBlock: 100,
  });
  const transfer = {
    eventName: "Transfer",
    args: { value: 100n, from: SALE, to: INVESTOR },
    transactionHash: HASH,
    index: 0,
    blockNumber: 100,
  };
  const purchase = {
    eventName: "Purchased",
    args: { quantity: 100n, buyer: INVESTOR, paid: 10n ** 17n },
    transactionHash: HASH,
    index: 1,
    blockNumber: 100,
  };
  const token = {
    filters: {
      Transfer: () => "Transfer",
      WhitelistUpdated: () => "WhitelistUpdated",
    },
    queryFilter: vi
      .fn()
      .mockImplementation(async (_filter, from) =>
        from === 100 ? [transfer] : [],
      ),
  };
  const sale = {
    queryFilter: vi
      .fn()
      .mockImplementation(async (_filter, from) =>
        from === 100 ? [purchase] : [],
      ),
  };
  const factory = {
    filters: { AssetCreated: () => "AssetCreated" },
    queryFilter: vi.fn().mockResolvedValue([]),
  };
  vi.spyOn(api, "token").mockReturnValue(token as any);
  vi.spyOn(api, "sale").mockReturnValue(sale as any);
  vi.spyOn(api, "factory").mockReturnValue(factory as any);
  return { api, token, sale, provider };
}
describe("On-chain event history", () => {
  it("starts at deployment block, bounds ranges and deduplicates purchase transfers", async () => {
    const { api, token } = fixture();
    const rows = await assetHistory(api, asset, INVESTOR);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "Purchase",
      quantity: 100n,
      paid: 10n ** 17n,
      timestamp: 1700000000,
    });
    expect(token.queryFilter.mock.calls.map((c) => c.slice(1))).toEqual([
      [100, 2099],
      [2100, 4099],
      [4100, 4100],
    ]);
  });
  it("splits provider-limited event ranges", async () => {
    const { api, token, provider } = fixture();
    vi.mocked(provider.getBlockNumber).mockResolvedValue(103);
    token.queryFilter.mockImplementation(async (_filter, from, to) => {
      if (to > from) throw new Error("block range limit exceeded");
      return [];
    });
    const rows = await assetHistory(api, asset, INVESTOR);
    expect(
      token.queryFilter.mock.calls.some((c) => c[1] === 103 && c[2] === 103),
    ).toBe(true);
    expect(rows).toHaveLength(1);
  });
  it("surfaces an RPC outage without recursively retrying thousands of ranges", async () => {
    const { api, token } = fixture();
    token.queryFilter.mockRejectedValue(new Error("Network unavailable"));
    await expect(assetHistory(api, asset, INVESTOR)).rejects.toThrow(
      "Network unavailable",
    );
    expect(token.queryFilter).toHaveBeenCalledOnce();
  });
  // AUD-013: forcedTransfer emits Transfer and ForcedTransfer in one transaction.
  // Phase 4 §8.4 requires the transaction type, and one operation must not appear twice.
  it("shows a forced transfer once, typed as forced, to the holder, the recipient and the admin view", async () => {
    const { api, token, sale } = fixture();
    const forcedHash = `0x${"cd".repeat(32)}`;
    sale.queryFilter.mockResolvedValue([]);
    token.queryFilter.mockImplementation(async (_filter, from) =>
      from === 100
        ? [
            {
              eventName: "Transfer",
              args: { value: 40n, from: INVESTOR, to: RECIPIENT },
              transactionHash: forcedHash,
              index: 0,
              blockNumber: 100,
            },
            {
              eventName: "ForcedTransfer",
              args: { from: INVESTOR, to: RECIPIENT, amount: 40n },
              transactionHash: forcedHash,
              index: 1,
              blockNumber: 100,
            },
          ]
        : [],
    );
    for (const account of [INVESTOR, RECIPIENT, undefined]) {
      const rows = (await assetHistory(api, asset, account)).filter(
        (r) => r.hash === forcedHash,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: "Forced transfer",
        quantity: 40n,
        from: INVESTOR,
        to: RECIPIENT,
      });
    }
  });
  // AUD-017: D5 pause/unpause and AccessControl role changes are token operations too.
  // Phase 4 §8.4 requires each row's transaction type; AUD-013's rule requires every
  // event consumer to label new operations.
  it("labels pause, unpause and role changes instead of dropping them", async () => {
    const { api, token, sale } = fixture();
    sale.queryFilter.mockResolvedValue([]);
    const role = `0x${"00".repeat(32)}`;
    const event = (eventName: string, args: object, index: number) => ({
      eventName,
      args,
      transactionHash: `0x${String(index).repeat(64)}`,
      index,
      blockNumber: 100,
    });
    token.queryFilter.mockImplementation(async (_filter, from) =>
      from === 100
        ? [
            event("Paused", { account: ISSUER }, 1),
            event("Unpaused", { account: ISSUER }, 2),
            event(
              "RoleGranted",
              { role, account: RECIPIENT, sender: ISSUER },
              3,
            ),
            event(
              "RoleRevoked",
              { role, account: RECIPIENT, sender: ISSUER },
              4,
            ),
          ]
        : [],
    );
    const rows = await assetHistory(api, asset);
    const byType = (type: string) => rows.filter((r) => r.type === type);
    expect(byType("Paused")).toHaveLength(1);
    expect(byType("Paused")[0]).toMatchObject({ from: ISSUER });
    expect(byType("Unpaused")).toHaveLength(1);
    expect(byType("Role granted")).toHaveLength(1);
    expect(byType("Role granted")[0]).toMatchObject({
      from: ISSUER,
      to: RECIPIENT,
    });
    expect(byType("Role revoked")).toHaveLength(1);
  });
  it("handles unavailable timestamps without hiding verified events", async () => {
    const { api, provider } = fixture();
    vi.mocked(provider.getBlock).mockRejectedValue(
      new Error("block unavailable"),
    );
    const rows = await assetHistory(api, asset, INVESTOR);
    expect(rows).toHaveLength(1);
    expect(rows[0].timestamp).toBeUndefined();
  });
});
