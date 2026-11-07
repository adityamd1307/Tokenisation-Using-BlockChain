import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockchain } from "../services/blockchain";
import * as registry from "../services/registry";
import * as history from "../services/history";
import { renderApp } from "./render";
import { change, connect, mockChain } from "./mocks";
import {
  asset,
  digital,
  HASH,
  INVESTOR,
  ISSUER,
  SALE,
  TOKEN,
} from "./fixtures";

beforeEach(() => {
  mockChain();
});
const table = () => screen.getByRole("table", { name: "Registered funds" });

describe("Fund registry", () => {
  it("shows an empty registry with the next step", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([]);
    renderApp();
    expect(
      await screen.findByText(/No funds are registered yet/),
    ).toBeInTheDocument();
  });
  it("lists every fund with price, inventory, supply and status from the contracts", async () => {
    renderApp();
    const row = (await screen.findByRole("link", { name: asset.name })).closest(
      "tr",
    )!;
    expect(row).toHaveTextContent("0.0010 ETH");
    expect(row).toHaveTextContent("5,000 CPT");
    expect(row).toHaveTextContent("10,000 CPT");
    expect(row).toHaveTextContent("Offering open");
    expect(
      within(table()).getByRole("link", { name: digital.name }),
    ).toBeInTheDocument();
  });
  it.each([
    ["0", asset.name, digital.name],
    ["1", digital.name, asset.name],
  ])("filters asset type %s", async (value, included, excluded) => {
    renderApp();
    await screen.findByRole("link", { name: asset.name });
    change("Asset type", value);
    expect(screen.getByRole("link", { name: included })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: excluded }),
    ).not.toBeInTheDocument();
  });
  it("searches names and symbols case-insensitively", async () => {
    renderApp();
    await screen.findByRole("link", { name: asset.name });
    change("Search funds", "dlt");
    expect(
      screen.queryByRole("link", { name: asset.name }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: digital.name }),
    ).toBeInTheDocument();
  });
  it("filters closed offerings and paused funds", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      asset,
      { ...digital, closed: true, paused: true },
    ]);
    renderApp();
    await screen.findByRole("link", { name: asset.name });
    change("Status", "closed");
    expect(
      screen.queryByRole("link", { name: asset.name }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Transfers paused", { selector: ".pill" }),
    ).toBeInTheDocument();
    change("Status", "paused");
    expect(
      screen.getByRole("link", { name: digital.name }),
    ).toBeInTheDocument();
  });
  it("offers to clear filters when nothing matches", async () => {
    renderApp();
    await screen.findByRole("link", { name: asset.name });
    change("Search funds", "zzz");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("link", { name: asset.name })).toBeInTheDocument();
  });
  it("reports an RPC failure with retry", async () => {
    vi.mocked(blockchain.assets).mockRejectedValueOnce(
      new Error("RPC offline"),
    );
    renderApp();
    expect(await screen.findByRole("alert")).toHaveTextContent("RPC offline");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("link", { name: asset.name }),
    ).toBeInTheDocument();
  });
});

describe("Fund overview", () => {
  it("opens the factsheet from the registry and asks to connect for the position", async () => {
    renderApp();
    fireEvent.click(await screen.findByRole("link", { name: asset.name }));
    expect(
      await screen.findByRole("heading", { level: 1, name: asset.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(asset.description)).toBeInTheDocument();
    expect(
      screen.getByText(/Connect a wallet to see your position/),
    ).toBeInTheDocument();
  });
  it("shows the fund facts, parties and contracts, and investors holding units", async () => {
    vi.mocked(registry.investorRegistry).mockResolvedValue([
      {
        address: ISSUER,
        eligible: true,
        balance: 4000n,
        compliance: true,
        tokenAdmin: true,
      },
      {
        address: SALE,
        eligible: true,
        balance: 5000n,
        compliance: false,
        tokenAdmin: false,
      },
      {
        address: INVESTOR,
        eligible: true,
        balance: 1000n,
        compliance: false,
        tokenAdmin: false,
      },
    ]);
    renderApp("/funds/0");
    const facts = await screen.findByLabelText("Fund facts");
    expect(facts).toHaveTextContent("Unit precisionWhole units (0 decimals)");
    expect(facts).toHaveTextContent("Price per unit0.0010 ETH");
    // Investors exclude the issuer's own supply and the sale inventory.
    const keyFigures = screen.getByRole("region", { name: "Key figures" });
    expect(
      await within(keyFigures).findByText("1", { selector: ".figure__value" }),
    ).toBeInTheDocument();
    await screen.findByText("4,000");
    expect(facts).toHaveTextContent("Held by investors1,000 CPT");
    expect(facts).toHaveTextContent("Held by the issuer4,000 CPT");
    expect(screen.getByLabelText("Parties and contracts")).toHaveTextContent(
      TOKEN,
    );
  });
  it("shows the investor's position once connected", async () => {
    renderApp("/funds/0");
    await screen.findByRole("heading", { level: 1, name: asset.name });
    await connect();
    const position = await screen.findByLabelText("Your position");
    expect(position).toHaveTextContent("100 CPT");
    expect(position).toHaveTextContent("0.1000 ETH");
    expect(position).toHaveTextContent("Verified investor");
  });
  it("shows a paused fund's status", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, paused: true },
    ]);
    renderApp("/funds/0");
    expect(
      await screen.findByText("Transfers paused", { selector: ".pill" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fund facts")).toHaveTextContent(
      "Paused by the issuer",
    );
  });
  it("renders the fund's recent on-chain activity", async () => {
    vi.mocked(history.assetHistory).mockResolvedValue([
      {
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
      },
    ]);
    renderApp("/funds/0");
    const recent = await screen.findByRole("table", {
      name: "Recent CPT activity",
    });
    expect(await within(recent).findByText("Purchase")).toBeInTheDocument();
    expect(recent).toHaveTextContent("Block 9");
    expect(recent).toHaveTextContent("0.1000 ETH");
  });
  it("says so when the fund ID does not exist", async () => {
    renderApp("/funds/9");
    expect(await screen.findByText(/No fund with this ID/)).toBeInTheDocument();
  });
  it("redirects Phase 4 /assets/:id links", async () => {
    renderApp("/assets/0");
    expect(
      await screen.findByRole("heading", { level: 1, name: asset.name }),
    ).toBeInTheDocument();
  });
});
