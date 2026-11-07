import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
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
  fireEvent.click(screen.getByRole("button", { name: /Connect wallet/i }));
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
  vi.spyOn(blockchain, "access").mockResolvedValue([]);
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
        await screen.findByText(/Asset creation: Pending/),
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
    await screen.findByText(/Asset creation: Failed/);
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
    await screen.findByText(/Issuer authorisation: Confirmed/);
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
    await screen.findByText(/Issuer revocation: Confirmed/);
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
