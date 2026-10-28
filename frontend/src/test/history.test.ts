import { describe, expect, it, vi } from "vitest";
import { JsonRpcProvider } from "ethers";
import { Blockchain } from "../services/blockchain";
import { assetHistory } from "../services/history";
import { asset, FACTORY, HASH, INVESTOR, SALE } from "./fixtures";
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
