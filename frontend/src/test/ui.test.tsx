import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Interface } from "ethers";
import { WalletProviderContext } from "../context/WalletContext";
import { DataProvider } from "../context/DataContext";
import { TransactionProvider } from "../context/TransactionContext";
import { AppRoutes } from "../App";
import { blockchain } from "../services/blockchain";
import * as history from "../services/history";
import { abis } from "../config/contracts";
import {
  accountState,
  asset,
  digital,
  FACTORY,
  HASH,
  INVESTOR,
  ISSUER,
  MockWallet,
  mockTransaction,
  RECIPIENT,
  SALE,
  TOKEN,
} from "./fixtures";

let provider: MockWallet;
function mount(path = "/") {
  return render(
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
  await waitFor(() => expect(blockchain.roles).toHaveBeenCalled());
}
const change = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
beforeEach(() => {
  provider = new MockWallet();
  window.ethereum = provider;
  vi.spyOn(blockchain, "ready").mockResolvedValue();
  vi.spyOn(blockchain, "assets").mockResolvedValue([asset, digital]);
  vi.spyOn(blockchain, "asset").mockResolvedValue(asset);
  vi.spyOn(blockchain, "roles").mockResolvedValue({
    admin: false,
    issuer: false,
  });
  vi.spyOn(blockchain.provider, "getBalance").mockResolvedValue(10n ** 18n);
  vi.spyOn(blockchain, "account").mockResolvedValue(accountState);
  vi.spyOn(blockchain, "holdings").mockResolvedValue([
    { asset, balance: 100n, eligible: true },
    { asset: digital, balance: 50n, eligible: true },
  ]);
  vi.spyOn(blockchain, "eligibility").mockResolvedValue(true);
  vi.spyOn(history, "assetHistory").mockResolvedValue([]);
  for (const name of [
    "buy",
    "transfer",
    "createAsset",
    "whitelist",
    "approve",
    "deposit",
    "manageSale",
    "authorizeIssuer",
  ] as const)
    vi.spyOn(blockchain, name).mockResolvedValue(mockTransaction());
  vi.spyOn(blockchain, "issuerStatus").mockResolvedValue(false);
});
describe("Marketplace", () => {
  it("shows an empty registry", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([]);
    mount();
    expect(
      await screen.findByText("No assets registered yet"),
    ).toBeInTheDocument();
  });
  it("renders real metadata from multiple contract results", async () => {
    mount();
    await screen.findByRole("heading", { name: asset.name });
    expect(
      screen.getByRole("heading", { name: digital.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(asset.description)).toBeInTheDocument();
    expect(screen.getByText("10,000 total supply")).toBeInTheDocument();
  });
  it.each([
    ["0", "Campus Property Token", "Digital Licensing Token"],
    ["1", "Digital Licensing Token", "Campus Property Token"],
  ])("filters category %s", async (value, included, excluded) => {
    mount();
    await screen.findByRole("heading", { name: asset.name });
    change("Asset category filter", value);
    expect(screen.getByRole("heading", { name: included })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: excluded }),
    ).not.toBeInTheDocument();
  });
  it("searches names and symbols case-insensitively", async () => {
    mount();
    await screen.findByRole("heading", { name: asset.name });
    change("Search assets", "dlt");
    expect(
      screen.queryByRole("heading", { name: asset.name }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: digital.name }),
    ).toBeInTheDocument();
  });
  it("filters closed offerings", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      asset,
      { ...digital, closed: true },
    ]);
    mount();
    await screen.findByRole("heading", { name: asset.name });
    change("Offering status filter", "closed");
    expect(
      screen.queryByRole("heading", { name: asset.name }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: digital.name }),
    ).toBeInTheDocument();
  });
  it("navigates from an asset card to its details", async () => {
    mount();
    fireEvent.click(await screen.findByRole("link", { name: asset.name }));
    expect(
      await screen.findByText("Connect your wallet to purchase this asset."),
    ).toBeInTheDocument();
    expect(blockchain.asset).toHaveBeenCalledWith("0");
  });
  it("reports an RPC failure with retry", async () => {
    vi.mocked(blockchain.assets).mockRejectedValueOnce(
      new Error("RPC offline"),
    );
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("RPC offline");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: asset.name }),
    ).toBeInTheDocument();
  });
});
describe("Creation and administrative permissions", () => {
  async function issuer() {
    provider.accounts = [ISSUER];
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: true,
    });
    mount("/issuer");
    await connect();
    await screen.findByRole("button", { name: "Create Asset" });
  }
  function fill(supply = "10000", price = "0.001") {
    change("Asset name", asset.name);
    change("Token symbol", "CPT");
    change("Total token supply", supply);
    change("Price per token (ETH)", price);
  }
  it("hides creation controls for unauthorised wallets", async () => {
    mount("/issuer");
    await connect();
    await screen.findByText(/This wallet cannot create new assets/);
    expect(
      screen.queryByRole("button", { name: "Create Asset" }),
    ).not.toBeInTheDocument();
    expect(blockchain.createAsset).not.toHaveBeenCalled();
  });
  it.each([
    ["1.5", "0.001", "Quantity must"],
    ["10000", "0", "Token price must"],
  ])(
    "rejects invalid supply or price (%s, %s)",
    async (supply, price, message) => {
      await issuer();
      fill(supply, price);
      fireEvent.click(screen.getByRole("button", { name: "Create Asset" }));
      expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
      expect(blockchain.createAsset).not.toHaveBeenCalled();
    },
  );
  it("shows pending confirmation, then refreshes and displays confirmed creation addresses", async () => {
    let confirm!: (value: any) => void;
    const iface = new Interface(abis.factory);
    const event = iface.encodeEventLog(iface.getEvent("AssetCreated")!, [
      0n,
      TOKEN,
      SALE,
      ISSUER,
    ]);
    vi.spyOn(blockchain, "factory").mockReturnValue({
      interface: iface,
    } as any);
    const oldAddress = blockchain.config.AssetFactory;
    blockchain.config.AssetFactory = FACTORY;
    vi.mocked(blockchain.createAsset).mockResolvedValue({
      hash: HASH,
      wait: () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    });
    try {
      await issuer();
      fill();
      const before = vi.mocked(blockchain.assets).mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "Create Asset" }));
      expect(
        await screen.findByText(/Asset creation · Pending confirmation/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Create Asset" }),
      ).toBeDisabled();
      expect(
        screen.queryByText("Asset Created Successfully"),
      ).not.toBeInTheDocument();
      await act(async () =>
        confirm({
          status: 1,
          hash: HASH,
          logs: [{ ...event, address: FACTORY }],
        }),
      );
      expect(
        await screen.findByText("Asset Created Successfully"),
      ).toBeInTheDocument();
      expect(vi.mocked(blockchain.assets).mock.calls.length).toBeGreaterThan(
        before,
      );
    } finally {
      blockchain.config.AssetFactory = oldAddress;
    }
  });
  it("does not claim success when creation reverts", async () => {
    vi.mocked(blockchain.createAsset).mockResolvedValue(mockTransaction(0));
    await issuer();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create Asset" }));
    await screen.findByText(/Asset creation · Failed/);
    expect(
      screen.queryByText("Asset Created Successfully"),
    ).not.toBeInTheDocument();
  });
  it("restricts administration to the actual platform role", async () => {
    mount("/admin");
    await connect();
    await screen.findByText("Administrator access required");
    expect(
      screen.queryByRole("button", { name: "Authorise Issuer" }),
    ).not.toBeInTheDocument();
  });
  it("checks an issuer and authorises it", async () => {
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: true,
      issuer: false,
    });
    mount("/admin");
    await connect();
    await screen.findByLabelText("Issuer Ethereum address");
    change("Issuer Ethereum address", ISSUER);
    fireEvent.click(
      screen.getByRole("button", { name: "Check issuer status" }),
    );
    await screen.findByText("Not authorised");
    fireEvent.click(screen.getByRole("button", { name: "Authorise Issuer" }));
    await screen.findByText(/Issuer authorisation · Confirmed/);
    expect(blockchain.authorizeIssuer).toHaveBeenCalledWith(
      provider,
      INVESTOR,
      ISSUER,
      true,
    );
  });
});
describe("Administrative confirmation sessions", () => {
  it("confirms issuer revocation and clears open dialogs when the wallet changes", async () => {
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: true,
      issuer: false,
    });
    vi.mocked(blockchain.issuerStatus).mockResolvedValue(true);
    mount("/admin");
    await connect();
    await screen.findByLabelText("Issuer Ethereum address");
    change("Issuer Ethereum address", ISSUER);
    fireEvent.click(
      screen.getByRole("button", { name: "Check issuer status" }),
    );
    await screen.findByText("Authorised issuer");
    fireEvent.click(
      screen.getByRole("button", { name: "Revoke authorisation" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Existing asset-token and sale contracts are not automatically deleted or frozen",
    );
    expect(blockchain.authorizeIssuer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText(/Issuer revocation · Confirmed/);
    expect(blockchain.authorizeIssuer).toHaveBeenCalledWith(
      provider,
      INVESTOR,
      ISSUER,
      false,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Revoke authorisation" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Revoke authorisation" }),
    );
    act(() => {
      provider.accounts = [RECIPIENT];
      provider.emit("accountsChanged", [RECIPIENT]);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
describe("Purchase feedback and data refresh", () => {
  async function purchase() {
    mount("/assets/0");
    await screen.findByText("Purchase tokens");
    await connect();
    await screen.findByText(/Eligible investor —/);
  }
  it("disables non-whitelisted purchases", async () => {
    vi.mocked(blockchain.account).mockResolvedValue({
      ...accountState,
      eligible: false,
    });
    mount("/assets/0");
    await connect();
    await screen.findByText(/Your wallet is not currently authorised/);
    change(/Quantity of tokens/, "100");
    expect(
      screen.getByRole("button", { name: /Purchase Tokens/ }),
    ).toBeDisabled();
    expect(blockchain.buy).not.toHaveBeenCalled();
  });
  it("calculates exact display payment and refreshes inventory after receipt", async () => {
    await purchase();
    change(/Quantity of tokens/, "100");
    expect(screen.getByText("0.1 ETH")).toBeInTheDocument();
    const before = vi.mocked(blockchain.asset).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Purchase Tokens/ }));
    await screen.findByText(/Token purchase · Confirmed/);
    await waitFor(() =>
      expect(vi.mocked(blockchain.asset).mock.calls.length).toBeGreaterThan(
        before,
      ),
    );
    expect(blockchain.buy).toHaveBeenCalledWith(
      provider,
      INVESTOR,
      asset,
      "100",
    );
  });
  it("blocks insufficient inventory", async () => {
    await purchase();
    change(/Quantity of tokens/, "5001");
    expect(screen.getByText(/offering has insufficient/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Purchase Tokens/ }),
    ).toBeDisabled();
  });
  it("disables closed offerings", async () => {
    vi.mocked(blockchain.asset).mockResolvedValue({ ...asset, closed: true });
    await purchase();
    change(/Quantity of tokens/, "1");
    expect(
      screen.getByRole("button", { name: /Purchase Tokens/ }),
    ).toBeDisabled();
  });
  it.each([
    ["Rejected by user", { code: 4001 }],
    ["Failed or reverted", new Error("RPC unavailable")],
  ])("reports %s without claiming success", async (label, error) => {
    vi.mocked(blockchain.buy).mockRejectedValue(error);
    await purchase();
    change(/Quantity of tokens/, "1");
    fireEvent.click(screen.getByRole("button", { name: /Purchase Tokens/ }));
    await screen.findByText(`Token purchase · ${label}`);
    expect(
      screen.queryByText(/Token purchase · Confirmed/),
    ).not.toBeInTheDocument();
  });
  it("reports a reverted purchase receipt", async () => {
    vi.mocked(blockchain.buy).mockResolvedValue(mockTransaction(0));
    await purchase();
    change(/Quantity of tokens/, "1");
    fireEvent.click(screen.getByRole("button", { name: /Purchase Tokens/ }));
    await screen.findByText("Token purchase · Failed or reverted");
  });
  it("keeps a timed-out submitted transaction unconfirmed and checks its receipt before allowing another purchase", async () => {
    const transaction = mockTransaction();
    transaction.wait.mockRejectedValue({
      code: "TIMEOUT",
      message: "Receipt timeout",
    });
    vi.mocked(blockchain.buy).mockResolvedValue(transaction);
    vi.spyOn(blockchain.provider, "getTransactionReceipt").mockResolvedValue({
      hash: HASH,
      status: 1,
    } as any);
    await purchase();
    change(/Quantity of tokens/, "1");
    fireEvent.click(screen.getByRole("button", { name: /Purchase Tokens/ }));
    await screen.findByText("Token purchase · Confirmation not yet verified");
    expect(
      screen.getByRole("button", { name: /Purchase Tokens/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check confirmation" }));
    await screen.findByText("Token purchase · Confirmed successfully");
    expect(blockchain.provider.getTransactionReceipt).toHaveBeenCalledWith(
      HASH,
    );
  });
});
describe("Portfolio and transfers", () => {
  it("handles no holdings", async () => {
    vi.mocked(blockchain.holdings).mockResolvedValue([]);
    mount("/portfolio");
    await connect();
    expect(await screen.findByText("No tokens held")).toBeInTheDocument();
  });
  it("displays multiple balances and sends an approved transfer", async () => {
    mount("/portfolio");
    await connect();
    await screen.findByText("My tokenised assets");
    expect(
      screen.getByRole("heading", { name: digital.name }),
    ).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    change("Recipient address", RECIPIENT);
    change("Transfer quantity", "20");
    await screen.findByText("Recipient is approved for this asset.");
    fireEvent.click(screen.getByRole("button", { name: "Transfer Tokens" }));
    await screen.findByText(/Token transfer · Confirmed/);
    expect(blockchain.transfer).toHaveBeenCalledWith(
      provider,
      INVESTOR,
      asset,
      RECIPIENT,
      "20",
    );
  });
  it("blocks an ineligible recipient", async () => {
    vi.mocked(blockchain.eligibility).mockResolvedValue(false);
    mount("/portfolio");
    await connect();
    await screen.findByLabelText("Recipient address");
    change("Recipient address", RECIPIENT);
    change("Transfer quantity", "20");
    await screen.findByText(/This recipient is not authorised/);
    expect(
      screen.getByRole("button", { name: "Transfer Tokens" }),
    ).toBeDisabled();
  });
  it("blocks insufficient balances", async () => {
    mount("/portfolio");
    await connect();
    await screen.findByLabelText("Transfer quantity");
    change("Recipient address", RECIPIENT);
    change("Transfer quantity", "101");
    await screen.findByText("Insufficient token balance.");
    expect(
      screen.getByRole("button", { name: "Transfer Tokens" }),
    ).toBeDisabled();
  });
  it("clears holdings immediately on account change", async () => {
    mount("/portfolio");
    await connect();
    await screen.findByText("My tokenised assets");
    vi.mocked(blockchain.holdings).mockImplementation(
      () => new Promise(() => {}),
    );
    act(() => {
      provider.accounts = [RECIPIENT];
      provider.emit("accountsChanged", [RECIPIENT]);
    });
    expect(screen.queryByText("My tokenised assets")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(blockchain.holdings).toHaveBeenLastCalledWith(
        [asset, digital],
        RECIPIENT,
      ),
    );
  });
  it("renders actual event values returned by history", async () => {
    vi.mocked(history.assetHistory).mockImplementation(async (_api, a) =>
      a.id === "0"
        ? [
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
          ]
        : [],
    );
    mount("/portfolio");
    await connect();
    await screen.findByRole("cell", { name: "Purchase" });
    expect(screen.getByText("#9")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByText("0.1 ETH"),
    ).toBeInTheDocument();
  });
});
