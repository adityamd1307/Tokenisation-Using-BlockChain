import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockchain } from "../services/blockchain";
import * as history from "../services/history";
import { PAUSED } from "../utils/errors";
import { renderApp } from "./render";
import { change, connect, mockChain } from "./mocks";
import {
  accountState,
  asset,
  digital,
  HASH,
  INVESTOR,
  ISSUER,
  MockWallet,
  RECIPIENT,
  SALE,
} from "./fixtures";
import type { Activity } from "../types";

let provider: MockWallet;
beforeEach(() => {
  provider = mockChain();
});

describe("Holdings", () => {
  it("asks for a wallet first", async () => {
    renderApp("/portfolio");
    expect(
      await screen.findByText(/Connect a wallet to see your holdings/),
    ).toBeInTheDocument();
  });
  it("says what to do when nothing is held", async () => {
    vi.mocked(blockchain.holdings).mockResolvedValue([]);
    renderApp("/portfolio");
    await connect();
    expect(
      await screen.findByText(
        "No holdings yet. Subscribe to a fund to receive units.",
      ),
    ).toBeInTheDocument();
  });
  it("lists each position with units, value at issue price and eligibility", async () => {
    renderApp("/portfolio");
    await connect();
    const table = await screen.findByRole("table", { name: "Positions" });
    const cpt = within(table)
      .getByRole("link", { name: asset.name })
      .closest("tr")!;
    expect(cpt).toHaveTextContent("100 CPT");
    expect(cpt).toHaveTextContent("0.1000 ETH");
    expect(cpt).toHaveTextContent("Verified");
    const dlt = within(table)
      .getByRole("link", { name: digital.name })
      .closest("tr")!;
    expect(dlt).toHaveTextContent("50 DLT");
    // 100 × 0.001 + 50 × 0.002 = 0.2 ETH
    expect(
      screen.getByRole("region", { name: "Portfolio summary" }),
    ).toHaveTextContent("0.2000 ETH");
  });
  it("clears holdings immediately on account change", async () => {
    renderApp("/portfolio");
    await connect();
    await screen.findByRole("link", { name: digital.name });
    vi.mocked(blockchain.holdings).mockImplementation(
      () => new Promise(() => {}),
    );
    act(() => {
      provider.accounts = [RECIPIENT];
      provider.emit("accountsChanged", [RECIPIENT]);
    });
    expect(
      screen.queryByRole("link", { name: digital.name }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(blockchain.holdings).toHaveBeenLastCalledWith(
        [asset, digital],
        RECIPIENT,
      ),
    );
  });
  it("shows the wallet's own activity", async () => {
    const row: Activity = {
      id: "event",
      type: "Purchase",
      asset: "CPT",
      quantity: 100n,
      paid: 10n ** 17n,
      from: SALE,
      to: INVESTOR,
      hash: HASH,
      block: 9,
      index: 0,
      timestamp: 1700000000,
    };
    vi.mocked(history.assetHistory).mockImplementation(
      async (_api, a, account) =>
        a.id === "0" && account === INVESTOR ? [row] : [],
    );
    renderApp("/portfolio");
    await connect();
    const table = await screen.findByRole("table", { name: "Your activity" });
    expect(await within(table).findByText("Purchase")).toBeInTheDocument();
    expect(table).toHaveTextContent("Block 9");
    expect(table).toHaveTextContent("0.1000 ETH");
  });
});

describe("Transfer", () => {
  const submit = () => screen.getByRole("button", { name: "Transfer" });
  async function open() {
    renderApp("/funds/0/transfer");
    await screen.findByRole("heading", { level: 1, name: "Transfer" });
    await connect();
    await screen.findByLabelText("Recipient address");
  }
  it("sends units to a verified recipient after showing what will happen", async () => {
    await open();
    change("Recipient address", RECIPIENT);
    change("Units to send", "20");
    await screen.findByText("Recipient is a verified investor in CPT.");
    expect(screen.getByText(/You will send/).closest("p")).toHaveTextContent(
      "You will send 20 CPT to 0x4000…0004.",
    );
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    await screen.findByText("Transfer: Confirmed");
    expect(blockchain.transfer).toHaveBeenCalledWith(
      provider,
      INVESTOR,
      asset,
      RECIPIENT,
      "20",
    );
  });
  it("blocks a transfer to an unverified recipient with the reason", async () => {
    vi.mocked(blockchain.eligibility).mockResolvedValue(false);
    await open();
    change("Recipient address", RECIPIENT);
    change("Units to send", "20");
    expect(
      await screen.findByText(
        /Recipient is not a verified investor in CPT\. A transfer to it would be rejected/,
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(submit()).toHaveAccessibleDescription(
        /Recipient is not a verified investor in CPT/,
      ),
    );
    expect(submit()).toBeDisabled();
    expect(blockchain.transfer).not.toHaveBeenCalled();
  });
  it("blocks a sender whose eligibility was revoked", async () => {
    vi.mocked(blockchain.account).mockResolvedValue({
      ...accountState,
      eligible: false,
    });
    await open();
    change("Recipient address", RECIPIENT);
    change("Units to send", "1");
    await waitFor(() =>
      expect(submit()).toHaveAccessibleDescription(/eligibility .* revoked/),
    );
  });
  it("blocks insufficient balances", async () => {
    await open();
    change("Recipient address", RECIPIENT);
    change("Units to send", "101");
    await waitFor(() =>
      expect(submit()).toHaveAccessibleDescription("Insufficient balance."),
    );
    expect(submit()).toBeDisabled();
  });
  it("blocks every transfer while the fund is paused", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, paused: true },
    ]);
    await open();
    change("Recipient address", RECIPIENT);
    change("Units to send", "1");
    await waitFor(() => expect(submit()).toHaveAccessibleDescription(PAUSED));
  });
  it("rejects an invalid address and fills Max with the balance", async () => {
    await open();
    change("Recipient address", "0x123");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "valid, nonzero Ethereum address",
    );
    fireEvent.click(screen.getByRole("button", { name: /^Max/ }));
    expect(screen.getByLabelText("Units to send")).toHaveValue("100");
  });
});

describe("Activity log", () => {
  const rows: Activity[] = [
    {
      id: "a",
      type: "Purchase",
      asset: "CPT",
      quantity: 100n,
      paid: 10n ** 17n,
      from: SALE,
      to: INVESTOR,
      hash: HASH,
      block: 9,
      index: 0,
    },
    {
      id: "b",
      type: "Paused",
      asset: "CPT",
      from: ISSUER,
      hash: `0x${"cd".repeat(32)}`,
      block: 10,
      index: 0,
    },
  ];
  it("lists events with filters by type and address", async () => {
    vi.mocked(history.assetHistory).mockImplementation(async (_api, a) =>
      a.id === "0" ? rows : [],
    );
    renderApp("/activity");
    const table = await screen.findByRole("table", { name: "Event log" });
    expect(await within(table).findByText("Paused")).toBeInTheDocument();
    expect(within(table).getByText("Purchase")).toBeInTheDocument();
    change("Event type", "Paused");
    expect(within(table).queryByText("Purchase")).not.toBeInTheDocument();
    change("Event type", "all");
    change("Address or transaction", INVESTOR.slice(0, 12));
    expect(within(table).queryByText("Paused")).not.toBeInTheDocument();
    expect(within(table).getByText("Purchase")).toBeInTheDocument();
  });
  it("scopes the log to one fund from the URL", async () => {
    renderApp("/activity?fund=1");
    await screen.findByRole("table", { name: "Event log" });
    await waitFor(() =>
      expect(history.assetHistory).toHaveBeenCalledWith(
        blockchain,
        digital,
        undefined,
      ),
    );
    expect(history.assetHistory).not.toHaveBeenCalledWith(
      blockchain,
      asset,
      undefined,
    );
  });
});
