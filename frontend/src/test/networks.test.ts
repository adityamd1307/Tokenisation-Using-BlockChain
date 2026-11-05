import { describe, expect, it } from "vitest";
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_PUBLIC_RPC,
  networkFor,
} from "../config/networks";

// Phase 5 D15/D16: the frontend runs against Sepolia with a keyless public read RPC.
describe("Target network configuration", () => {
  it("names Sepolia clearly and reads through the keyless PublicNode endpoint by default (D16)", () => {
    expect(networkFor(SEPOLIA_CHAIN_ID)).toEqual({
      chainId: 11155111,
      name: "Sepolia testnet",
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    });
    expect(SEPOLIA_PUBLIC_RPC).not.toMatch(/key|token|[0-9a-f]{32}/i);
  });
  it("lets VITE_RPC_URL override the Sepolia default", () => {
    expect(networkFor(SEPOLIA_CHAIN_ID, "https://rpc.example.test").rpcUrl).toBe(
      "https://rpc.example.test",
    );
  });
  it("keeps the local chain on 127.0.0.1:8545", () => {
    expect(networkFor(31337)).toEqual({
      chainId: 31337,
      name: "Local Ethereum",
      rpcUrl: "http://127.0.0.1:8545",
    });
  });
  it("labels an unknown chain by its ID rather than guessing a name", () => {
    expect(networkFor(1).name).toBe("Ethereum · 1");
  });
});
