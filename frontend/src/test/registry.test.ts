import { describe, expect, it, vi } from "vitest";
import { JsonRpcProvider, ZeroAddress } from "ethers";
import { Blockchain } from "../services/blockchain";
import {
  holderCount,
  investorRegistry,
  issuerDirectory,
} from "../services/registry";
import { eth, units } from "../utils/formatting";
import { asset, FACTORY, INVESTOR, ISSUER, RECIPIENT, SALE } from "./fixtures";

const log = (eventName: string, args: object, blockNumber = 10) => ({
  eventName,
  args,
  blockNumber,
  transactionHash: "0x",
  index: 0,
});

function fixture() {
  const provider = new JsonRpcProvider();
  vi.spyOn(provider, "getBlockNumber").mockResolvedValue(50);
  const api = new Blockchain(provider, {
    AssetFactory: FACTORY,
    chainId: 31337,
    deployBlock: 1,
  });
  return { api };
}

describe("Investor registry from events", () => {
  it("lists every whitelisted, holding or role-holding address with live state", async () => {
    const { api } = fixture();
    const balances: Record<string, bigint> = {
      [ISSUER]: 5000n,
      [SALE]: 4900n,
      [INVESTOR]: 100n,
      [RECIPIENT]: 0n,
    };
    const token = {
      queryFilter: vi
        .fn()
        .mockResolvedValue([
          log("WhitelistUpdated", { investor: ISSUER, approved: true }, 2),
          log("Transfer", { from: ZeroAddress, to: ISSUER, value: 10000n }, 2),
          log("WhitelistUpdated", { investor: SALE, approved: true }, 3),
          log("Transfer", { from: SALE, to: INVESTOR, value: 100n }, 5),
          log("WhitelistUpdated", { investor: INVESTOR, approved: false }, 9),
          log("RoleGranted", {
            account: RECIPIENT,
            role: "0x",
            sender: ISSUER,
          }),
        ]),
      isWhitelisted: vi.fn(async (a: string) => a !== INVESTOR),
      balanceOf: vi.fn(async (a: string) => balances[a]),
      hasRole: vi.fn(async (_role: string, a: string) => a === RECIPIENT),
    };
    vi.spyOn(api, "token").mockReturnValue(token as never);
    const rows = await investorRegistry(api, asset);
    expect(rows.map((r) => r.address).sort()).toEqual(
      [ISSUER, SALE, INVESTOR, RECIPIENT].sort(),
    );
    expect(rows.find((r) => r.address === INVESTOR)).toMatchObject({
      eligible: false,
      balance: 100n,
      changedBlock: 9,
    });
    expect(rows.find((r) => r.address === RECIPIENT)?.compliance).toBe(true);
    // Neither the sale contract's inventory nor the issuer's supply is an investor.
    expect(holderCount(rows, asset)).toBe(1);
  });
});

describe("Issuer directory from events", () => {
  it("keeps the latest change per issuer and reads current status", async () => {
    const { api } = fixture();
    const factory = {
      queryFilter: vi
        .fn()
        .mockResolvedValue([
          log("IssuerAuthorised", { issuer: ISSUER }, 2),
          log("IssuerAuthorised", { issuer: INVESTOR }, 3),
          log("IssuerRevoked", { issuer: INVESTOR }, 7),
          log("AssetCreated", { issuer: ISSUER }, 8),
        ]),
      authorisedIssuers: vi.fn(async (a: string) => a === ISSUER),
    };
    vi.spyOn(api, "factory").mockReturnValue(factory as never);
    expect(await issuerDirectory(api)).toEqual([
      { address: ISSUER, authorised: true, changedBlock: 2 },
      { address: INVESTOR, authorised: false, changedBlock: 7 },
    ]);
  });
});

describe("Amount formatting", () => {
  it.each([
    [10n ** 17n, "0.1000"],
    [10n ** 15n, "0.0010"],
    [123456789n * 10n ** 9n, "0.123456789"],
    [12345n * 10n ** 18n, "12,345.0000"],
    [0n, "0.0000"],
  ])("formats %s wei as %s ETH without losing precision", (wei, text) => {
    expect(eth(wei)).toBe(text);
  });
  it("groups whole units", () => {
    expect(units(1234567n)).toBe("1,234,567");
  });
});
