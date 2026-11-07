import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Interface, MaxUint256 } from "ethers";
import { AppRoutes } from "../App";
import { WalletProviderContext } from "../context/WalletContext";
import { DataProvider } from "../context/DataContext";
import { TransactionProvider } from "../context/TransactionContext";
import { blockchain } from "../services/blockchain";
import {
  subscriptions,
  type Offering,
  type SubscriptionAccount,
} from "../services/subscriptions";
import {
  demandPercent,
  musd,
  offeringArgs,
  parseUSD,
} from "../utils/subscription";
import {
  asset,
  accountState,
  INVESTOR,
  ISSUER,
  SALE,
  TOKEN,
  MockWallet,
  mockTransaction,
} from "./fixtures";
import * as history from "../services/history";
import { abis } from "../config/contracts";
let provider: MockWallet, o: Offering, a: SubscriptionAccount;
const U = (x: number) => BigInt(x) * 1_000_000n;
beforeEach(() => {
  provider = new MockWallet();
  window.ethereum = provider;
  o = {
    address: SALE,
    assetId: "0",
    issuer: ISSUER,
    paymentToken: TOKEN,
    supply: 1000n,
    price: U(2),
    softCap: U(1200),
    hardCap: U(2000),
    start: 100n,
    end: 280n,
    state: 1,
    demand: 0n,
    subscribers: 0n,
    deposited: 1000n,
    inventory: 1000n,
    guaranteed: 0n,
    recognized: 0n,
    withdrawn: 0n,
    recoverable: 0n,
    settledCount: 0n,
    finalized: false,
    chainTime: 150n,
  };
  a = {
    balance: U(10000),
    allowance: 0n,
    commitment: 0n,
    allocation: 0n,
    accepted: 0n,
    refund: 0n,
    settled: false,
    claimed: false,
    eligible: true,
    offeringEligible: true,
    paused: false,
    assetBalance: 10000n,
    assetAllowance: 0n,
  };
  vi.spyOn(subscriptions, "enabled", "get").mockReturnValue(true);
  vi.spyOn(subscriptions, "get").mockImplementation(async () => ({ ...o }));
  vi.spyOn(subscriptions, "list").mockImplementation(async () => ({
    items: [{ ...o }],
    hasMore: false,
  }));
  vi.spyOn(subscriptions, "account").mockImplementation(async () => ({ ...a }));
  vi.spyOn(subscriptions, "history").mockResolvedValue({ rows: [] });
  vi.spyOn(subscriptions, "action").mockResolvedValue(mockTransaction());
  vi.spyOn(blockchain, "assets").mockResolvedValue([asset]);
  vi.spyOn(blockchain, "asset").mockResolvedValue(asset);
  vi.spyOn(blockchain, "roles").mockResolvedValue({
    admin: false,
    issuer: false,
  });
  vi.spyOn(blockchain.provider, "getBalance").mockResolvedValue(10n ** 18n);
  vi.spyOn(blockchain, "account").mockResolvedValue({
    ...accountState,
    balance: 10000n,
    compliance: true,
  });
  vi.spyOn(history, "assetHistory").mockResolvedValue([]);
});
function mount(path = `/offerings/${SALE}`) {
  render(
    <WalletProviderContext>
      <DataProvider>
        <TransactionProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </TransactionProvider>
      </DataProvider>
    </WalletProviderContext>,
  );
}
async function connect() {
  fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
  await screen.findByRole("heading", { name: "Your subscription" });
}
describe("Subscription precision", () => {
  it("parses and formats six decimals without floating point", () => {
    expect(parseUSD("1800.000001")).toBe(1800000001n);
    expect(musd(1800000001n)).toBe("1800.000001");
    expect(parseUSD("9007199254740993")).toBe(9007199254740993000000n);
    for (const s of ["0", "-1", "1e6", "1.0000001", "", MaxUint256.toString()])
      expect(() => parseUSD(s)).toThrow();
    expect(demandPercent(U(4000), U(2000))).toBe("200.00");
  });
  it("validates immutable caps, whole units and timestamps", () => {
    const input = {
      supply: "1000",
      price: "2",
      softCap: "1200",
      start: "2030-01-01T00:00:00Z",
      end: "2030-01-01T00:03:00Z",
    };
    expect(offeringArgs(input, 0n).slice(0, 3)).toEqual([1000n, U(2), U(1200)]);
    for (const bad of [
      { supply: "1.5" },
      { softCap: "2001" },
      { start: "bad" },
      { end: input.start },
      { price: MaxUint256.toString() },
    ])
      expect(() => offeringArgs({ ...input, ...bad }, 0n)).toThrow();
  });
});
describe("Subscription interface", () => {
  it("shows 200% demand without prematurely labelling the offering successful", async () => {
    o.demand = U(4000);
    mount("/subscriptions");
    expect(await screen.findByText("200.00% of hard cap")).toBeInTheDocument();
    expect(screen.getByText("Subscription Open")).toBeInTheDocument();
    expect(screen.queryByText("Successful")).not.toBeInTheDocument();
  });
  it("separates approval and commitment and retains the entered amount across receipt refresh", async () => {
    vi.mocked(subscriptions.action).mockImplementation(
      async (_w, _who, _at, op) => {
        if (op === "approveUSD") a.allowance = U(1800);
        if (op === "commit") a.commitment = U(1800);
        return mockTransaction();
      },
    );
    mount();
    await connect();
    fireEvent.change(screen.getByLabelText("Commitment amount (mUSD)"), {
      target: { value: "1800" },
    });
    expect(
      screen.getByRole("button", { name: "Commit stablecoins" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Approve mUSD" }));
    await screen.findByText(/Approve mUSD · Confirmed/);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Commit stablecoins" }),
      ).toBeEnabled(),
    );
    expect(screen.getByLabelText("Commitment amount (mUSD)")).toHaveValue(
      "1800",
    );
    fireEvent.click(screen.getByRole("button", { name: "Commit stablecoins" }));
    await screen.findByText(/Commit mUSD · Confirmed/);
    expect(subscriptions.action).toHaveBeenCalledWith(
      provider,
      INVESTOR,
      SALE,
      "commit",
      "1800",
    );
  });
  it("blocks invalid amounts, insufficient funds, eligibility failures and underfunding", async () => {
    a.eligible = false;
    o.deposited = 0n;
    mount();
    await connect();
    fireEvent.change(screen.getByLabelText("Commitment amount (mUSD)"), {
      target: { value: "1800" },
    });
    expect(screen.getByRole("button", { name: "Approve mUSD" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Commit stablecoins" }),
    ).toBeDisabled();
    expect(screen.getByText(/not fully funded/)).toBeInTheDocument();
  });
  it("keeps refunds enabled when revoked eligibility blocks token claims", async () => {
    o.state = 3;
    o.finalized = true;
    o.guaranteed = U(1996);
    a = {
      ...a,
      commitment: U(1800),
      allocation: 450n,
      accepted: U(900),
      refund: U(900),
      settled: true,
      eligible: false,
    };
    mount();
    await connect();
    expect(
      screen.getByRole("button", { name: "Claim allocated tokens" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Withdraw refund" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw refund" }));
    await screen.findByText(/Withdraw mUSD refund · Confirmed/);
  });
  it("requires settlement before payouts and reflects already claimed entitlements", async () => {
    o.state = 3;
    o.finalized = true;
    a = {
      ...a,
      commitment: U(1800),
      allocation: 450n,
      accepted: U(900),
      refund: U(900),
    };
    vi.mocked(subscriptions.action).mockImplementation(
      async (_w, _who, _at, op) => {
        if (op === "settleSubscription") a.settled = true;
        return mockTransaction();
      },
    );
    mount();
    await connect();
    expect(
      screen.getByRole("button", { name: "Withdraw refund" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Settle subscription" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Withdraw refund" }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole("button", { name: "Subscription settled" }),
    ).toBeDisabled();
  });
  it("allows finalisation after closing and shows failed offering full refunds", async () => {
    o.state = 2;
    a.commitment = U(700);
    vi.mocked(subscriptions.action).mockImplementation(async () => {
      o = { ...o, state: 4, finalized: true };
      a.refund = U(700);
      return mockTransaction();
    });
    mount();
    await connect();
    fireEvent.click(screen.getByRole("button", { name: "Finalise offering" }));
    await screen.findByText(/Failed. No tokens are allocated/);
    expect(
      screen.getByRole("button", { name: "Claim allocated tokens" }),
    ).toBeDisabled();
  });
  it("does not expose issuer controls to investors", async () => {
    mount();
    await connect();
    expect(
      screen.queryByRole("heading", { name: "Manage offering" }),
    ).not.toBeInTheDocument();
  });
  it("funds inventory through separate eligibility, approval and deposit operations", async () => {
    provider.accounts = [ISSUER];
    o.state = 0;
    o.deposited = 0n;
    a.offeringEligible = false;
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: true,
    });
    vi.mocked(subscriptions.action).mockImplementation(
      async (_w, _who, _at, op) => {
        if (op === "whitelistOffering") a.offeringEligible = true;
        if (op === "approveInventory") a.assetAllowance = 1000n;
        return mockTransaction();
      },
    );
    mount();
    await connect();
    fireEvent.change(screen.getByLabelText("Offering inventory deposit"), {
      target: { value: "1000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Approve offering eligibility" }),
    );
    await screen.findByText(/Approve offering eligibility · Confirmed/);
    fireEvent.click(
      await screen.findByRole("button", { name: "Approve token spending" }),
    );
    await screen.findByText(/Approve offering inventory · Confirmed/);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Deposit inventory" }),
      ).toBeEnabled(),
    );
    expect(screen.getByLabelText("Offering inventory deposit")).toHaveValue(
      "1000",
    );
    fireEvent.click(screen.getByRole("button", { name: "Deposit inventory" }));
    await screen.findByText(/Deposit offering inventory · Confirmed/);
  });
  it("displays wallet rejection without reporting confirmation", async () => {
    vi.mocked(subscriptions.action).mockRejectedValue({ code: 4001 });
    mount();
    await connect();
    fireEvent.change(screen.getByLabelText("Commitment amount (mUSD)"), {
      target: { value: "1800" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve mUSD" }));
    await screen.findByText(/Rejected by user/);
    expect(
      screen.queryByText(/Confirmed successfully/),
    ).not.toBeInTheDocument();
  });
  it("creates offerings from the existing issuer workspace with exact input values", async () => {
    provider.accounts = [ISSUER];
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: true,
    });
    vi.spyOn(subscriptions, "create").mockResolvedValue(mockTransaction());
    mount("/issuer");
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    await screen.findByRole("heading", {
      name: "Create a subscription offering",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create subscription offering" }),
    );
    await screen.findByText(/Create subscription offering · Confirmed/);
    expect(subscriptions.create).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      expect.objectContaining({ supply: "1000", price: "2", softCap: "1200" }),
    );
  });
  it("invalidates investor amounts on account changes", async () => {
    mount();
    await connect();
    fireEvent.change(screen.getByLabelText("Commitment amount (mUSD)"), {
      target: { value: "1800" },
    });
    await act(async () => {
      provider.accounts = [ISSUER];
      provider.emit("accountsChanged", [ISSUER]);
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Commitment amount (mUSD)")).toHaveValue(""),
    );
  });
});
