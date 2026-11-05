import { describe, expect, it, vi } from "vitest";

// AUD-015: the unit tests' mock wallet is on chain 31337 (0x7a69), but the app's target chain was read
// from the committed frontend/src/config/addresses.json. Under Phase 5 D18 that file points at Sepolia
// once the Sepolia deployment is committed, and 39 unit tests then fail as "wrong network".
// This mock stands in for that committed Sepolia file.
vi.mock("../config/addresses.json", () => ({
  default: {
    note: "AUD-015 regression: simulated committed Sepolia deployment",
    network: "sepolia",
    chainId: 11155111,
    AssetFactory: "0x00000000000000000000000000000000000000aa",
    admin: "0x00000000000000000000000000000000000000bb",
    deployBlock: 5,
    deployBlockHash: "0x" + "11".repeat(32),
    runtimeCodeHash: "0x" + "22".repeat(32),
  },
}));

import { targetNetwork } from "../config/networks";
import { blockchain } from "../services/blockchain";
import { switchNetwork } from "../services/wallet";
import { MockWallet } from "./fixtures";

describe("AUD-015 unit tests are isolated from the committed deployment", () => {
  it("targets the local test chain even when addresses.json points at Sepolia", async () => {
    const wallet = new MockWallet(); // the unit tests' wallet, on 0x7a69
    await switchNetwork(wallet);
    expect(wallet.request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }],
    });
    expect(targetNetwork.chainId).toBe(31337);
    expect(blockchain.config.chainId).toBe(31337);
  });
});
