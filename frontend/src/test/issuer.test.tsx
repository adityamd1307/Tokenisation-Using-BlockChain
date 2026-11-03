import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WalletProviderContext } from "../context/WalletContext";
import { DataProvider } from "../context/DataContext";
import { TransactionProvider } from "../context/TransactionContext";
import { AppRoutes } from "../App";
import { blockchain } from "../services/blockchain";
import * as history from "../services/history";
import {
  accountState,
  asset,
  INVESTOR,
  ISSUER,
  MockWallet,
  mockTransaction,
  SALE,
} from "./fixtures";
let provider: MockWallet;
beforeEach(() => {
  provider = new MockWallet();
  provider.accounts = [ISSUER];
  window.ethereum = provider;
  vi.spyOn(blockchain, "assets").mockResolvedValue([asset]);
  vi.spyOn(blockchain, "roles").mockResolvedValue({
    admin: false,
    issuer: true,
  });
  vi.spyOn(blockchain.provider, "getBalance").mockResolvedValue(10n ** 18n);
  vi.spyOn(blockchain, "account").mockResolvedValue({
    ...accountState,
    balance: 10000n,
    compliance: true,
    tokenAdmin: true,
    saleEligible: false,
  });
  vi.spyOn(blockchain, "eligibility").mockResolvedValue(false);
  vi.spyOn(history, "assetHistory").mockResolvedValue([]);
  for (const method of [
    "whitelist",
    "approve",
    "deposit",
    "manageSale",
    "restoreCompliance",
  ] as const)
    vi.spyOn(blockchain, method).mockResolvedValue(mockTransaction());
});
async function mount() {
  render(
    <WalletProviderContext>
      <DataProvider>
        <TransactionProvider>
          <MemoryRouter initialEntries={["/issuer"]}>
            <AppRoutes />
          </MemoryRouter>
        </TransactionProvider>
      </DataProvider>
    </WalletProviderContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
  await screen.findByRole("heading", { name: "Investor eligibility" });
}
describe("Issuer controls", () => {
  it("looks up and approves an investor", async () => {
    await mount();
    fireEvent.change(screen.getByLabelText("Investor Ethereum address"), {
      target: { value: INVESTOR },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check eligibility" }));
    await screen.findByText("Not approved");
    fireEvent.click(screen.getByRole("button", { name: "Approve Investor" }));
    await screen.findByText(/Eligibility approval · Confirmed/);
    expect(blockchain.whitelist).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      INVESTOR,
      true,
    );
  });
  it("requires confirmation before revoking eligibility", async () => {
    vi.mocked(blockchain.eligibility).mockResolvedValue(true);
    await mount();
    fireEvent.change(screen.getByLabelText("Investor Ethereum address"), {
      target: { value: INVESTOR },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check eligibility" }));
    await screen.findByText("Approved investor");
    fireEvent.click(screen.getByRole("button", { name: "Revoke eligibility" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "even if it already holds tokens",
    );
    expect(blockchain.whitelist).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(blockchain.whitelist).toHaveBeenCalledWith(
        provider,
        ISSUER,
        asset,
        INVESTOR,
        false,
      ),
    );
  });
  it("whitelists the actual sale contract", async () => {
    await mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Approve Sale Contract" }),
    );
    await screen.findByText(/Eligibility approval · Confirmed/);
    expect(blockchain.whitelist).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      SALE,
      true,
    );
  });
  it("blocks approval/deposit until sale eligibility is restored", async () => {
    await mount();
    fireEvent.change(screen.getByLabelText("Deposit quantity"), {
      target: { value: "5000" },
    });
    expect(
      screen.getByRole("button", { name: "1. Approve Token Spending" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "2. Deposit Tokens" }),
    ).toBeDisabled();
  });
  it("performs separate approval and deposit transactions and refreshes allowance", async () => {
    const state = {
      ...accountState,
      balance: 10000n,
      compliance: true,
      tokenAdmin: true,
      allowance: 0n,
    };
    vi.mocked(blockchain.account).mockImplementation(async () => state);
    vi.mocked(blockchain.approve).mockImplementation(async () => ({
      ...mockTransaction(),
      wait: async () => {
        state.allowance = 5000n;
        return { status: 1, hash: "approval", logs: [] };
      },
    }));
    await mount();
    fireEvent.change(screen.getByLabelText("Deposit quantity"), {
      target: { value: "5000" },
    });
    expect(
      screen.getByRole("button", { name: "2. Deposit Tokens" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "1. Approve Token Spending" }),
    );
    await screen.findByText(/Token spending approval · Confirmed/);
    expect(blockchain.deposit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "2. Deposit Tokens" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "2. Deposit Tokens" }));
    await screen.findByText(/Inventory deposit · Confirmed/);
    expect(blockchain.approve).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      "5000",
    );
    expect(blockchain.deposit).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      "5000",
    );
  });
  it("keeps deposits disabled after a rejected approval", async () => {
    vi.mocked(blockchain.account).mockResolvedValue({
      ...accountState,
      balance: 10000n,
      compliance: true,
    });
    vi.mocked(blockchain.approve).mockRejectedValue({ code: 4001 });
    await mount();
    fireEvent.change(screen.getByLabelText("Deposit quantity"), {
      target: { value: "5000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "1. Approve Token Spending" }),
    );
    await screen.findByText(/Token spending approval · Rejected/);
    expect(
      screen.getByRole("button", { name: "2. Deposit Tokens" }),
    ).toBeDisabled();
    expect(blockchain.deposit).not.toHaveBeenCalled();
  });
  it("confirms proceeds withdrawal and shows the recipient", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, proceeds: 10n ** 17n, saleEth: 10n ** 17n },
    ]);
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw Proceeds" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      `Withdraw 0.1 ETH to issuer ${ISSUER}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(blockchain.manageSale).toHaveBeenCalledWith(
        provider,
        ISSUER,
        expect.anything(),
        "withdrawProceeds",
      ),
    );
  });
  it("disables withdrawal when no proceeds are available", async () => {
    await mount();
    expect(
      screen.getByRole("button", { name: "Withdraw Proceeds" }),
    ).toBeDisabled();
  });
  it("confirms permanent closure and refreshes purchase/deposit status", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Close Offering" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Closure cannot be undone",
    );
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, closed: true },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText(/Permanently close offering\? · Confirmed/);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Close Offering" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByRole("button", { name: "2. Deposit Tokens" }),
    ).toBeDisabled();
  });
  it("recovers unsold tokens only after closure with eligible endpoints", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, closed: true },
    ]);
    vi.mocked(blockchain.account).mockResolvedValue({
      ...accountState,
      compliance: true,
    });
    await mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Recover Unsold Tokens" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("5,000 CPT");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(blockchain.manageSale).toHaveBeenCalledWith(
        provider,
        ISSUER,
        expect.anything(),
        "recoverUnsoldTokens",
      ),
    );
  });
  it("retains existing asset controls for an issuer revoked at the factory", async () => {
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: false,
    });
    await mount();
    expect(
      screen.queryByRole("button", { name: "Create Asset" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close Offering" }),
    ).toBeEnabled();
  });
  it("does not leave stale transaction feedback after account switching", async () => {
    await mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Approve Sale Contract" }),
    );
    await screen.findByText(/Eligibility approval · Confirmed/);
    act(() => {
      provider.accounts = [INVESTOR];
      provider.emit("accountsChanged", [INVESTOR]);
    });
    expect(
      screen.queryByText(/Eligibility approval · Confirmed/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Investor eligibility")).not.toBeInTheDocument();
  });
});
