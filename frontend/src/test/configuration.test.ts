import { describe, expect, it, vi } from "vitest";
import { JsonRpcProvider, keccak256 } from "ethers";
import { Blockchain } from "../services/blockchain";
import { FACTORY, INVESTOR, ISSUER, MockWallet } from "./fixtures";
function fixture(extra = {}) {
  const provider = new JsonRpcProvider();
  vi.spyOn(provider, "getNetwork").mockResolvedValue({
    chainId: 31337n,
  } as any);
  vi.spyOn(provider, "getCode").mockResolvedValue("0x6000");
  vi.spyOn(provider, "getBlock").mockResolvedValue({
    hash: "current-chain",
  } as any);
  return new Blockchain(provider, {
    chainId: 31337,
    AssetFactory: FACTORY,
    deployBlock: 1,
    ...extra,
  });
}
describe("Deployment and signing guards", () => {
  it("reports a missing deployment rather than connecting to a guessed address", async () => {
    await expect(fixture({ AssetFactory: "" }).ready()).rejects.toThrow(
      "not configured",
    );
  });
  it("rejects an RPC on a different chain", async () => {
    const api = fixture();
    vi.mocked(api.provider.getNetwork).mockResolvedValue({
      chainId: 1n,
    } as any);
    await expect(api.ready()).rejects.toThrow("wrong network");
  });
  it("detects contracts removed by a local chain reset", async () => {
    const api = fixture();
    vi.mocked(api.provider.getCode).mockResolvedValue("0x");
    await expect(api.ready()).rejects.toThrow("deployment not found");
  });
  it("detects a reset even when a factory is redeployed at the same address", async () => {
    await expect(
      fixture({ deployBlockHash: "earlier-chain" }).ready(),
    ).rejects.toThrow("earlier blockchain session");
  });
  it("checks the deployed runtime bytecode hash", async () => {
    await expect(
      fixture({ runtimeCodeHash: keccak256("0x6001") }).ready(),
    ).rejects.toThrow("bytecode differs");
  });
  it("rejects a wallet on the wrong network before requesting a signer", async () => {
    const wallet = new MockWallet();
    wallet.chain = "0x1";
    await expect(fixture().signer(wallet, INVESTOR)).rejects.toThrow(
      "Wrong network",
    );
    expect(
      wallet.request.mock.calls.some(
        ([r]) => r.method === "eth_sendTransaction",
      ),
    ).toBe(false);
  });
  it("rejects a stale account captured before a wallet switch", async () => {
    const wallet = new MockWallet();
    wallet.accounts = [ISSUER];
    await expect(fixture().signer(wallet, INVESTOR)).rejects.toThrow(
      "Wallet account changed",
    );
  });
});
