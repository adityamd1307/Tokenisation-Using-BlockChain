import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProviderContext, useWallet } from "../context/WalletContext";
import {
  WalletControls,
  WalletNotices,
  WalletSummary,
} from "../components/WalletControls";
import { blockchain } from "../services/blockchain";
import { switchNetwork } from "../services/wallet";
import { ADMIN, INVESTOR, MockWallet } from "./fixtures";
import { shortAddress } from "../utils/formatting";
function Probe() {
  const w = useWallet();
  return (
    <>
      <WalletControls />
      <WalletNotices />
      <WalletSummary />
      <output data-testid="state">{`${w.account}:${w.roles?.admin}:${w.ethBalance}:${w.session}`}</output>
    </>
  );
}
function mount() {
  return render(
    <WalletProviderContext>
      <Probe />
    </WalletProviderContext>,
  );
}
beforeEach(() => {
  delete window.ethereum;
  vi.spyOn(blockchain, "roles").mockResolvedValue({
    admin: false,
    issuer: false,
  });
  vi.spyOn(blockchain.provider, "getBalance").mockResolvedValue(7n);
});
describe("Wallet integration", () => {
  it("connects via eth_requestAccounts and displays the address and roles", async () => {
    const provider = new MockWallet();
    window.ethereum = provider;
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    expect(
      (await screen.findAllByText(shortAddress(INVESTOR))).length,
    ).toBeGreaterThan(0);
    await screen.findByText("Investor");
    expect(provider.request).toHaveBeenCalledWith({
      method: "eth_requestAccounts",
    });
  });
  it("handles a missing wallet", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No compatible wallet found",
    );
  });
  it("handles wallet rejection", async () => {
    const provider = new MockWallet();
    provider.request.mockRejectedValueOnce({ code: 4001 });
    window.ethereum = provider;
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Request rejected",
    );
  });
  it("warns on the wrong network and switches to the configured chain", async () => {
    const provider = new MockWallet();
    provider.chain = "0x1";
    window.ethereum = provider;
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    expect(await screen.findByText(/Current: chain 1/)).toBeInTheDocument();
    expect(blockchain.roles).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Switch Network" }));
    await screen.findByText("Investor");
    expect(screen.queryByText(/Current: chain 1/)).not.toBeInTheDocument();
  });
  it("immediately clears old permissions and balances while a switched account loads", async () => {
    const provider = new MockWallet();
    provider.accounts = [ADMIN];
    window.ethereum = provider;
    vi.mocked(blockchain.roles)
      .mockResolvedValueOnce({ admin: true, issuer: false })
      .mockImplementationOnce(() => new Promise(() => {}));
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    await screen.findByText("Platform administrator");
    act(() => {
      provider.accounts = [INVESTOR];
      provider.emit("accountsChanged", [INVESTOR]);
    });
    expect(
      screen.queryByText("Platform administrator"),
    ).not.toBeInTheDocument();
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
    let resolve!: (roles: any) => void;
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
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    await waitFor(() => expect(blockchain.roles).toHaveBeenCalledTimes(1));
    act(() => {
      provider.accounts = [INVESTOR];
      provider.emit("accountsChanged", [INVESTOR]);
    });
    await screen.findByText("Investor");
    await act(async () => resolve({ admin: true, issuer: true }));
    expect(
      screen.queryByText("Platform administrator"),
    ).not.toBeInTheDocument();
  });
  it("clears the connected state on disconnect and removes listeners on unmount", async () => {
    const provider = new MockWallet();
    window.ethereum = provider;
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    await screen.findByText("Investor");
    act(() => provider.emit("disconnect"));
    await screen.findByRole("button", { name: /Connect Wallet/ });
    view.unmount();
    expect(
      [...provider.listeners.values()].every((set) => set.size === 0),
    ).toBe(true);
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
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
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
