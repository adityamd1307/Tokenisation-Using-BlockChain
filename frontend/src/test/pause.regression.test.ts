// AUD-016: spec-v1 §5 "D5 functions" — while an AssetToken is paused, transfer,
// AssetSale.allocate, buyTokens and recoverUnsoldTokens all revert (invariant 5).
// The frontend must say so before the user signs, and decode EnforcedPause.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Interface, JsonRpcProvider, parseEther } from "ethers";
import { Blockchain } from "../services/blockchain";
import { errorMessage } from "../utils/errors";
import { abis } from "../config/contracts";
import {
  accountState,
  asset,
  FACTORY,
  INVESTOR,
  ISSUER,
  MockWallet,
  mockTransaction,
  RECIPIENT,
} from "./fixtures";

const wallet = new MockWallet();
let api: Blockchain;
let methods: Record<string, ReturnType<typeof vi.fn>>;
const paused = { ...asset, paused: true };

beforeEach(() => {
  const provider = new JsonRpcProvider();
  api = new Blockchain(provider, {
    chainId: 31337,
    AssetFactory: FACTORY,
    deployBlock: 1,
  });
  methods = Object.fromEntries(
    ["buyTokens", "transfer", "allocate", "recoverUnsoldTokens"].map((name) => [
      name,
      vi.fn().mockResolvedValue(mockTransaction()),
    ]),
  );
  vi.spyOn(api, "token").mockReturnValue(methods as any);
  vi.spyOn(api, "sale").mockReturnValue(methods as any);
  vi.spyOn(api, "signer").mockResolvedValue({} as any);
  vi.spyOn(api, "asset").mockResolvedValue(paused);
  vi.spyOn(api, "account").mockResolvedValue({
    ...accountState,
    balance: 10000n,
    allowance: 10000n,
  });
  vi.spyOn(api, "eligibility").mockResolvedValue(true);
  vi.spyOn(provider, "getBalance").mockResolvedValue(parseEther("1"));
});

describe("AUD-016 paused token", () => {
  it("blocks a purchase before the wallet is asked to sign", async () => {
    await expect(api.buy(wallet, INVESTOR, asset, "1")).rejects.toThrow(
      /paused/i,
    );
    expect(methods.buyTokens).not.toHaveBeenCalled();
  });
  it("blocks a transfer before the wallet is asked to sign", async () => {
    await expect(
      api.transfer(wallet, INVESTOR, asset, RECIPIENT, "1"),
    ).rejects.toThrow(/paused/i);
    expect(methods.transfer).not.toHaveBeenCalled();
  });
  it("blocks an inventory deposit before the wallet is asked to sign", async () => {
    await expect(api.deposit(wallet, ISSUER, asset, "1")).rejects.toThrow(
      /paused/i,
    );
    expect(methods.allocate).not.toHaveBeenCalled();
  });
  it("blocks unsold-token recovery before the wallet is asked to sign", async () => {
    await expect(
      api.manageSale(
        wallet,
        ISSUER,
        { ...asset, closed: true },
        "recoverUnsoldTokens",
      ),
    ).rejects.toThrow(/paused/i);
    expect(methods.recoverUnsoldTokens).not.toHaveBeenCalled();
  });
  it("decodes an EnforcedPause revert into plain English", () => {
    const data = new Interface(abis.token).encodeErrorResult(
      "EnforcedPause",
      [],
    );
    const message = errorMessage({ code: "CALL_EXCEPTION", data });
    expect(message).toMatch(/paused/i);
    expect(message).not.toMatch(/EnforcedPause|Contract rejected/);
  });
});
