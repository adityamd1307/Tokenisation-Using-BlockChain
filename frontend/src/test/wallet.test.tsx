import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WalletProviderContext, useWallet } from "../context/WalletContext";
import { DataProvider } from "../context/DataContext";
import { FundProvider } from "../context/FundContext";
import { TopBar } from "../components/shell/TopBar";
import { NetworkBanner } from "../components/shell/AppShell";
import { blockchain } from "../services/blockchain";
import { switchNetwork } from "../services/wallet";
import { ADMIN, asset, INVESTOR, MockWallet } from "./fixtures";
import { shortAddress } from "../utils/formatting";

function Probe() {
  const w = useWallet();
  return (
    <>
      <TopBar menuOpen={false} onMenu={() => {}} />
      <NetworkBanner />
      <output data-testid="state">{`${w.account}:${w.roles?.admin}:${w.ethBalance}:${w.session}`}</output>
    </>
  );
}
function mount() {
  return render(
    <WalletProviderContext>
      <DataProvider>
        <FundProvider>
          <MemoryRouter>
            <Probe />
          </MemoryRouter>
        </FundProvider>
      </DataProvider>
    </WalletProviderContext>,
  );
}
const connect = () =>
  fireEvent.click(screen.getByRole("button", { name: /Connect wallet/ }));

beforeEach(() => {
  delete window.ethereum;
  vi.spyOn(blockchain, "roles").mockResolvedValue({
    admin: false,
    issuer: false,
  });
  vi.spyOn(blockchain, "assets").mockResolvedValue([asset]);
  vi.spyOn(blockchain, "access").mockResolvedValue([
    {
      assetId: "0",
      eligible: true,
      compliance: false,
      tokenAdmin: false,
      saleIssuer: false,
    },
  ]);
  vi.spyOn(blockchain.provider, "getBalance").mockResolvedValue(7n);
});
describe("Wallet integration", () => {
  it("connects via eth_requestAccounts and shows the address and the role in the selected fund", async () => {
    const provider = new MockWallet();
    window.ethereum = provider;
    mount();
    connect();
    expect(await screen.findByText(shortAddress(INVESTOR))).toBeInTheDocument();
    expect(await screen.findByText("Investor")).toBeInTheDocument();
    expect(provider.request).toHaveBeenCalledWith({
      method: "eth_requestAccounts",
    });
  });
  it("handles a missing wallet", async () => {
    mount();
    connect();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No compatible wallet found",
    );
  });
  it("handles wallet rejection", async () => {
    const provider = new MockWallet();
    provider.request.mockRejectedValueOnce({ code: 4001 });
    window.ethereum = provider;
    mount();
    connect();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Request rejected",
    );
  });
  it("shows a persistent wrong-network banner and switches to the configured chain", async () => {
    const provider = new MockWallet();
    provider.chain = "0x1";
    window.ethereum = provider;
    mount();
    connect();
    expect(
      await screen.findByText(/Your wallet is on chain 1\./),
    ).toBeInTheDocument();
    expect(blockchain.roles).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Switch network" }));
    await screen.findByText("Investor");
    expect(
      screen.queryByText(/Your wallet is on chain 1\./),
    ).not.toBeInTheDocument();
  });
  it("immediately clears old permissions and balances while a switched account loads", async () => {
    const provider = new MockWallet();
    provider.accounts = [ADMIN];
    window.ethereum = provider;
    vi.mocked(blockchain.roles)
      .mockResolvedValueOnce({ admin: true, issuer: false })
      .mockImplementationOnce(() => new Promise(() => {}));
    mount();
    connect();
    await screen.findByText("Platform admin");
    act(() => {
      provider.accounts = [INVESTOR];
      provider.emit("accountsChanged", [INVESTOR]);
    });
    expect(screen.queryByText("Platform admin")).not.toBeInTheDocument();
    expect(screen.getByTestId("state")).toHaveTextContent(
      "null:undefined:null",
    );
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent(
        `${INVESTOR}:undefined:null`,
      ),
    );
  });
  it("ignores a delayed old-account role response", async () => {
    let resolve!: (roles: { admin: boolean; issuer: boolean }) => void;
    vi.mocked(blockchain.roles)
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValueOnce({ admin: false, issuer: false });
    const provider = new MockWallet();
    provider.accounts = [ADMIN];
    window.ethereum = provider;
    mount();
    connect();
    await waitFor(() => expect(blockchain.roles).toHaveBeenCalledTimes(1));
    act(() => {
      provider.accounts = [INVESTOR];
      provider.emit("accountsChanged", [INVESTOR]);
    });
    await screen.findByText("Investor");
    await act(async () => resolve({ admin: true, issuer: true }));
    expect(screen.queryByText("Platform admin")).not.toBeInTheDocument();
  });
  it("clears the connected state on disconnect and removes listeners on unmount", async () => {
    const provider = new MockWallet();
    window.ethereum = provider;
    const view = mount();
    connect();
    await screen.findByText("Investor");
    act(() => provider.emit("disconnect"));
    await screen.findByRole("button", { name: /Connect wallet/ });
    expect(screen.queryByText(shortAddress(INVESTOR))).not.toBeInTheDocument();
    view.unmount();
    expect(
      [...provider.listeners.values()].every((set) => set.size === 0),
    ).toBe(true);
  });
  it("disconnects from the top bar", async () => {
    window.ethereum = new MockWallet();
    mount();
    connect();
    await screen.findByText("Investor");
    fireEvent.click(screen.getByRole("button", { name: "Disconnect wallet" }));
    await screen.findByRole("button", { name: /Connect wallet/ });
  });
  it("discovers multiple EIP-6963 wallets and uses the selected provider", async () => {
    const first = new MockWallet(),
      second = new MockWallet();
    mount();
    act(() => {
      for (const [uuid, provider] of [
        ["one", first],
        ["two", second],
      ] as const)
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: { info: { uuid, name: uuid }, provider },
          }),
        );
    });
    fireEvent.change(screen.getByLabelText("Wallet provider"), {
      target: { value: "two" },
    });
    connect();
    await screen.findByText("Investor");
    expect(first.request).not.toHaveBeenCalled();
    expect(second.request).toHaveBeenCalled();
  });
  it("adds an unknown configured network, then explicitly switches", async () => {
    const provider = new MockWallet();
    provider.request.mockRejectedValueOnce({ code: 4902 });
    await switchNetwork(provider);
    expect(
      provider.request.mock.calls.map(([request]) => request.method),
    ).toEqual([
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
    ]);
  });
});
