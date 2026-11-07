// Phase 6 I13 / AUD-030: identical chain IDs do not identify a local deployment.
import { describe, expect, it, vi } from "vitest";
import { JsonRpcProvider, keccak256 } from "ethers";
import { Blockchain } from "../services/blockchain";
import { FACTORY, INVESTOR } from "./fixtures";
import type { WalletProvider } from "../types";
const blockHash = `0x${"12".repeat(32)}`;
function fixture(code = "0x6000", hash = blockHash) {
  const provider = new JsonRpcProvider();
  vi.spyOn(provider, "getNetwork").mockResolvedValue({
    chainId: 31337n,
  } as any);
  vi.spyOn(provider, "getCode").mockResolvedValue("0x6000");
  vi.spyOn(provider, "getBlock").mockResolvedValue({ hash: blockHash } as any);
  const api = new Blockchain(provider, {
    chainId: 31337,
    AssetFactory: FACTORY,
    deployBlock: 1,
    runtimeCodeHash: keccak256("0x6000"),
    deployBlockHash: blockHash,
  });
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === "eth_chainId") return "0x7a69";
    if (method === "eth_accounts") return [INVESTOR];
    if (method === "eth_getCode") return code;
    if (method === "eth_getBlockByNumber")
      return {
        hash,
        number: "0x1",
        parentHash: blockHash,
        timestamp: "0x1",
        nonce: "0x0000000000000000",
        difficulty: "0x0",
        gasLimit: "0x100000",
        gasUsed: "0x0",
        miner: INVESTOR,
        extraData: "0x",
        transactions: [],
      };
    throw new Error(`Unexpected wallet method ${method}`);
  });
  return { api, wallet: { request } as WalletProvider, request };
}
describe("Signing deployment security (AUD-030)", () => {
  it.each([
    ["missing factory", "0x", blockHash, "deployment not found"],
    ["different factory code", "0x6001", blockHash, "bytecode differs"],
    [
      "different local chain session",
      "0x6000",
      `0x${"34".repeat(32)}`,
      "earlier blockchain session",
    ],
  ])(
    "rejects %s on the wallet RPC despite matching chain ID",
    async (_name, code, hash, error) => {
      const { api, wallet, request } = fixture(code, hash);
      await expect(api.signer(wallet, INVESTOR)).rejects.toThrow(error);
      expect(
        request.mock.calls.some(([r]) =>
          /eth_sendTransaction|eth_requestAccounts/.test(r.method),
        ),
      ).toBe(false);
    },
  );
  it("returns the intended signer when both RPCs agree on the deployment", async () => {
    const { api, wallet, request } = fixture();
    expect(await (await api.signer(wallet, INVESTOR)).getAddress()).toBe(
      INVESTOR,
    );
    expect(request.mock.calls.some(([r]) => r.method === "eth_getCode")).toBe(
      true,
    );
    expect(
      request.mock.calls.some(([r]) => r.method === "eth_getBlockByNumber"),
    ).toBe(true);
  });
});
