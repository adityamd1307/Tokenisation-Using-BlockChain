import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockchain } from "../services/blockchain";
import { PAUSED } from "../utils/errors";
import { renderApp } from "./render";
import { change, connect, mockChain } from "./mocks";
import {
  accountState,
  asset,
  HASH,
  INVESTOR,
  MockWallet,
  mockTransaction,
} from "./fixtures";

let provider: MockWallet;
beforeEach(() => {
  provider = mockChain();
});
const submit = () => screen.getByRole("button", { name: "Subscribe" });
async function open() {
  renderApp("/funds/0/subscribe");
  await screen.findByRole("heading", { level: 1, name: "Subscribe" });
  await connect();
  await screen.findByLabelText("Units to subscribe");
}

describe("Subscription", () => {
  it("asks for a wallet before showing the order form", async () => {
    renderApp("/funds/0/subscribe");
    expect(
      await screen.findByText(/Connect a wallet to subscribe to this fund/),
    ).toBeInTheDocument();
  });
  it("blocks a wallet that is not a verified investor and says why", async () => {
    vi.mocked(blockchain.account).mockResolvedValue({
      ...accountState,
      eligible: false,
    });
    await open();
    change("Units to subscribe", "100");
    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveAccessibleDescription(
      /not a verified investor in this fund/,
    );
    expect(blockchain.buy).not.toHaveBeenCalled();
  });
  it("shows the exact payment before signing, subscribes, and refreshes inventory", async () => {
    await open();
    change("Units to subscribe", "100");
    expect(screen.getByText(/You will pay/).closest("p")).toHaveTextContent(
      "You will pay 0.1000 ETH and receive 100 CPT.",
    );
    await waitFor(() => expect(submit()).toBeEnabled());
    const before = vi.mocked(blockchain.assets).mock.calls.length;
    fireEvent.click(submit());
    await screen.findByText("Subscription: Confirmed");
    expect(blockchain.buy).toHaveBeenCalledWith(
      provider,
      INVESTOR,
      asset,
      "100",
    );
    await waitFor(() =>
      expect(vi.mocked(blockchain.assets).mock.calls.length).toBeGreaterThan(
        before,
      ),
    );
  });
  it("reports the confirming block number", async () => {
    vi.mocked(blockchain.buy).mockResolvedValue({
      hash: HASH,
      wait: vi.fn().mockResolvedValue({
        hash: HASH,
        status: 1,
        logs: [],
        blockNumber: 42,
      }),
    } as never);
    await open();
    change("Units to subscribe", "1");
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    expect(
      await screen.findByText("Confirmed in block 42."),
    ).toBeInTheDocument();
  });
  it("fills Max with the smaller of inventory and what the ETH balance covers", async () => {
    await open();
    // 1 ETH at 0.001 ETH per unit covers 1,000 units; 5,000 are available.
    fireEvent.click(screen.getByRole("button", { name: /^Max/ }));
    expect(screen.getByLabelText("Units to subscribe")).toHaveValue("1000");
  });
  it("rejects fractional amounts", async () => {
    await open();
    change("Units to subscribe", "1.5");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no decimal places",
    );
    expect(submit()).toBeDisabled();
  });
  it("blocks insufficient inventory", async () => {
    vi.spyOn(blockchain.provider, "getBalance").mockResolvedValue(10n ** 20n);
    await open();
    change("Units to subscribe", "5001");
    await waitFor(() =>
      expect(submit()).toHaveAccessibleDescription(
        "Only 5,000 CPT are available.",
      ),
    );
    expect(submit()).toBeDisabled();
  });
  it("blocks a payment the ETH balance does not cover", async () => {
    await open();
    change("Units to subscribe", "1001");
    await waitFor(() =>
      expect(submit()).toHaveAccessibleDescription(
        /ETH balance does not cover/,
      ),
    );
  });
  it.each([
    [
      "a closed offering",
      { closed: true },
      "This offering is permanently closed.",
    ],
    ["a paused fund", { paused: true }, PAUSED],
  ])("disables %s", async (_name, change_, message) => {
    vi.mocked(blockchain.assets).mockResolvedValue([{ ...asset, ...change_ }]);
    await open();
    change("Units to subscribe", "1");
    await waitFor(() => expect(submit()).toHaveAccessibleDescription(message));
    expect(submit()).toBeDisabled();
  });
  it.each([
    ["Rejected in wallet", { code: 4001 }],
    ["Failed", new Error("RPC unavailable")],
  ])("reports %s without claiming success", async (label, error) => {
    vi.mocked(blockchain.buy).mockRejectedValue(error);
    await open();
    change("Units to subscribe", "1");
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    await screen.findByText(`Subscription: ${label}`);
    expect(
      screen.queryByText("Subscription: Confirmed"),
    ).not.toBeInTheDocument();
  });
  it("reports a reverted receipt as failed", async () => {
    vi.mocked(blockchain.buy).mockResolvedValue(mockTransaction(0) as never);
    await open();
    change("Units to subscribe", "1");
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    await screen.findByText("Subscription: Failed");
  });
  // AUD-010: a receipt timeout is not a failure; submission stays blocked until verified.
  it("keeps a timed-out transaction unconfirmed and checks its receipt before allowing another", async () => {
    const transaction = mockTransaction();
    transaction.wait.mockRejectedValue({
      code: "TIMEOUT",
      message: "Receipt timeout",
    });
    vi.mocked(blockchain.buy).mockResolvedValue(transaction as never);
    vi.spyOn(blockchain.provider, "getTransactionReceipt").mockResolvedValue({
      hash: HASH,
      status: 1,
      blockNumber: 7,
    } as never);
    await open();
    change("Units to subscribe", "1");
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    await screen.findByText("Subscription: Not yet verified");
    change("Units to subscribe", "2");
    expect(submit()).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Dismiss transaction status" }),
    ).not.toBeInTheDocument();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Check confirmation" }),
      ),
    );
    await screen.findByText("Subscription: Confirmed");
    expect(blockchain.provider.getTransactionReceipt).toHaveBeenCalledWith(
      HASH,
    );
  });
});
