import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Interface } from "ethers";
import { blockchain } from "../services/blockchain";
import * as registry from "../services/registry";
import { abis } from "../config/contracts";
import { renderApp } from "./render";
import { access, change, connect, mockChain } from "./mocks";
import {
  accountState,
  asset,
  FACTORY,
  HASH,
  INVESTOR,
  ISSUER,
  MockWallet,
  RECIPIENT,
  SALE,
  TOKEN,
} from "./fixtures";

let provider: MockWallet;
const issuerAccess = access({
  saleIssuer: true,
  compliance: true,
  tokenAdmin: true,
});
const issuerState = {
  ...accountState,
  balance: 10000n,
  compliance: true,
  tokenAdmin: true,
  saleEligible: false,
};
beforeEach(() => {
  provider = mockChain(ISSUER);
  vi.mocked(blockchain.roles).mockResolvedValue({ admin: false, issuer: true });
  vi.mocked(blockchain.access).mockResolvedValue(issuerAccess);
  vi.mocked(blockchain.account).mockResolvedValue(issuerState);
  vi.mocked(blockchain.eligibility).mockResolvedValue(false);
});
const button = (name: string | RegExp) => screen.getByRole("button", { name });
async function open(page: string, heading: string) {
  renderApp(`/issuer/0/${page}`);
  await connect();
  await screen.findByRole("heading", { level: 1, name: heading });
}
const dialog = () => screen.getByRole("dialog");

describe("Issuer dashboard visibility", () => {
  it("shows the issuer workspace only to wallets with an on-chain role", async () => {
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: false,
    });
    vi.mocked(blockchain.access).mockResolvedValue(access());
    renderApp("/");
    await connect();
    await screen.findByText("Investor");
    expect(
      screen.queryByRole("group", { name: "Issuer dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Administration" }),
    ).not.toBeInTheDocument();
  });
  it("lists the issuer pages for the fund's issuer", async () => {
    renderApp("/");
    await connect();
    const group = await screen.findByRole("group", {
      name: "Issuer dashboard",
    });
    for (const name of [
      "Investor registry",
      "Offering",
      "Token controls",
      "Create fund",
    ])
      expect(within(group).getByRole("link", { name })).toBeInTheDocument();
    expect(await screen.findByText("Issuer")).toBeInTheDocument();
  });
  it("blocks a page whose role the wallet lacks", async () => {
    vi.mocked(blockchain.access).mockResolvedValue(
      access({ compliance: true }),
    );
    await open("controls", "Token controls");
    expect(await screen.findByText(/Only a token admin/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pause transfers/ }),
    ).not.toBeInTheDocument();
  });
});

describe("Investor registry", () => {
  it("looks up and verifies an investor", async () => {
    await open("registry", "Investor registry");
    change("Investor address", INVESTOR);
    await screen.findByText("Not verified for CPT");
    await waitFor(() => expect(button("Verify investor")).toBeEnabled());
    fireEvent.click(button("Verify investor"));
    await screen.findByText("Verify investor: Confirmed");
    expect(blockchain.whitelist).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      INVESTOR,
      true,
    );
  });
  it("requires confirmation with the Phase 4 warning before revoking", async () => {
    vi.mocked(blockchain.eligibility).mockResolvedValue(true);
    await open("registry", "Investor registry");
    change("Investor address", INVESTOR);
    await screen.findByText("Verified investor in CPT");
    fireEvent.click(button("Revoke eligibility"));
    expect(dialog()).toHaveTextContent("even if it already holds tokens");
    expect(blockchain.whitelist).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Revoke eligibility" }),
    );
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
  it("lists registry rows with status, balance and roles, and offers forced transfer for a revoked holder", async () => {
    vi.mocked(registry.investorRegistry).mockResolvedValue([
      {
        address: ISSUER,
        eligible: true,
        balance: 5000n,
        compliance: true,
        tokenAdmin: true,
        changedBlock: 2,
      },
      {
        address: SALE,
        eligible: true,
        balance: 4900n,
        compliance: false,
        tokenAdmin: false,
        changedBlock: 3,
      },
      {
        address: INVESTOR,
        eligible: false,
        balance: 100n,
        compliance: false,
        tokenAdmin: false,
        changedBlock: 9,
      },
    ]);
    await open("registry", "Investor registry");
    const table = await screen.findByRole("table", {
      name: "CPT investor registry",
    });
    const revoked = (await within(table).findByText("Revoked")).closest("tr")!;
    expect(revoked).toHaveTextContent("100 CPT");
    expect(revoked).toHaveTextContent("Block 9");
    expect(within(table).getByText("Sale contract")).toBeInTheDocument();
    fireEvent.click(
      within(revoked).getByRole("button", { name: /Forced transfer/ }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Token controls" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("From (revoked holder)")).toHaveValue(
      INVESTOR,
    );
  });
  it("lets a token admin without the compliance role restore it", async () => {
    vi.mocked(blockchain.access).mockResolvedValue(
      access({ saleIssuer: true, tokenAdmin: true }),
    );
    vi.mocked(blockchain.account).mockResolvedValue({
      ...issuerState,
      compliance: false,
    });
    await open("registry", "Investor registry");
    fireEvent.click(
      await screen.findByRole("button", { name: "Restore my compliance role" }),
    );
    await screen.findByText("Restore compliance role: Confirmed");
    expect(blockchain.restoreCompliance).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
    );
  });
});

describe("Offering", () => {
  it("verifies the actual sale contract from the prerequisites", async () => {
    await open("offering", "Offering");
    fireEvent.click(
      await screen.findByRole("button", { name: "Verify sale contract" }),
    );
    await screen.findByText("Verify address: Confirmed");
    expect(blockchain.whitelist).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      SALE,
      true,
    );
  });
  it("blocks approval and deposit until the sale contract is verified", async () => {
    await open("offering", "Offering");
    change("Deposit quantity", "5000");
    await waitFor(() =>
      expect(button("1. Approve")).toHaveAccessibleDescription(
        "Verify the sale contract first.",
      ),
    );
    expect(button("2. Deposit")).toBeDisabled();
  });
  // AUD-009: the quantity survives the refresh after approval; two separate transactions.
  it("performs separate approval and deposit transactions and refreshes the allowance", async () => {
    const state = { ...issuerState, saleEligible: true, allowance: 0n };
    vi.mocked(blockchain.account).mockImplementation(async () => ({
      ...state,
    }));
    vi.mocked(blockchain.approve).mockImplementation(
      async () =>
        ({
          hash: HASH,
          wait: async () => {
            state.allowance = 5000n;
            return { status: 1, hash: HASH, logs: [] };
          },
        }) as never,
    );
    await open("offering", "Offering");
    change("Deposit quantity", "5000");
    await waitFor(() => expect(button("1. Approve")).toBeEnabled());
    expect(button("2. Deposit")).toBeDisabled();
    fireEvent.click(button("1. Approve"));
    await screen.findByText("Approve sale contract: Confirmed");
    expect(blockchain.deposit).not.toHaveBeenCalled();
    await waitFor(() => expect(button("2. Deposit")).toBeEnabled());
    expect(screen.getByLabelText("Deposit quantity")).toHaveValue("5000");
    expect(
      screen.getByText(/Current allowance: 5,000 CPT/),
    ).toBeInTheDocument();
    fireEvent.click(button("2. Deposit"));
    await screen.findByText("Inventory deposit: Confirmed");
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
  it("keeps the deposit disabled after a rejected approval", async () => {
    vi.mocked(blockchain.account).mockResolvedValue({
      ...issuerState,
      saleEligible: true,
    });
    vi.mocked(blockchain.approve).mockRejectedValue({ code: 4001 });
    await open("offering", "Offering");
    change("Deposit quantity", "5000");
    await waitFor(() => expect(button("1. Approve")).toBeEnabled());
    fireEvent.click(button("1. Approve"));
    await screen.findByText("Approve sale contract: Rejected in wallet");
    expect(button("2. Deposit")).toBeDisabled();
    expect(blockchain.deposit).not.toHaveBeenCalled();
  });
  it("confirms proceeds withdrawal and shows the recipient", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, proceeds: 10n ** 17n, saleEth: 10n ** 17n },
    ]);
    await open("offering", "Offering");
    fireEvent.click(button("Withdraw proceeds"));
    expect(dialog()).toHaveTextContent(
      `Withdraw 0.1000 ETH to issuer ${ISSUER}`,
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: "Withdraw" }));
    await waitFor(() =>
      expect(blockchain.manageSale).toHaveBeenCalledWith(
        provider,
        ISSUER,
        expect.anything(),
        "withdrawProceeds",
      ),
    );
  });
  it("disables withdrawal when there are no proceeds", async () => {
    await open("offering", "Offering");
    expect(button("Withdraw proceeds")).toHaveAccessibleDescription(
      "There are no proceeds to withdraw.",
    );
  });
  it("confirms permanent closure and then disables close and deposit", async () => {
    vi.mocked(blockchain.account).mockResolvedValue({
      ...issuerState,
      saleEligible: true,
    });
    await open("offering", "Offering");
    fireEvent.click(button("Close offering"));
    expect(dialog()).toHaveTextContent("Closure cannot be undone");
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, closed: true },
    ]);
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Close offering" }),
    );
    await screen.findByText("Close offering: Confirmed");
    await waitFor(() => expect(button("Close offering")).toBeDisabled());
    change("Deposit quantity", "1");
    expect(button("2. Deposit")).toBeDisabled();
  });
  it("recovers unsold units only after closure with verified endpoints", async () => {
    vi.mocked(blockchain.assets).mockResolvedValue([
      { ...asset, closed: true },
    ]);
    vi.mocked(blockchain.account).mockResolvedValue({
      ...issuerState,
      saleEligible: true,
    });
    await open("offering", "Offering");
    await waitFor(() => expect(button("Recover unsold units")).toBeEnabled());
    fireEvent.click(button("Recover unsold units"));
    expect(dialog()).toHaveTextContent("5,000 CPT");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Recover" }));
    await waitFor(() =>
      expect(blockchain.manageSale).toHaveBeenCalledWith(
        provider,
        ISSUER,
        expect.anything(),
        "recoverUnsoldTokens",
      ),
    );
  });
  it("keeps existing fund controls for an issuer revoked at the factory", async () => {
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: false,
    });
    await open("offering", "Offering");
    await waitFor(() => expect(button("Close offering")).toBeEnabled());
  });
  it("does not leave stale transaction feedback or controls after an account switch", async () => {
    await open("offering", "Offering");
    fireEvent.click(
      await screen.findByRole("button", { name: "Verify sale contract" }),
    );
    await screen.findByText("Verify address: Confirmed");
    vi.mocked(blockchain.access).mockResolvedValue(access());
    act(() => {
      provider.accounts = [INVESTOR];
      provider.emit("accountsChanged", [INVESTOR]);
    });
    expect(
      screen.queryByText("Verify address: Confirmed"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close offering" }),
    ).not.toBeInTheDocument();
  });
});

describe("Token controls", () => {
  it("pauses after confirmation", async () => {
    await open("controls", "Token controls");
    fireEvent.click(button("Pause transfers"));
    expect(dialog()).toHaveTextContent("except by forced transfer");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Pause" }));
    await screen.findByText("Pause: Confirmed");
    expect(blockchain.setPaused).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      true,
    );
  });
  it("forces a transfer from a revoked holder to a verified recipient", async () => {
    vi.mocked(blockchain.eligibility).mockImplementation(
      async (_a, who) => who === RECIPIENT,
    );
    vi.spyOn(blockchain, "balance").mockResolvedValue(100n);
    await open("controls", "Token controls");
    change("From (revoked holder)", INVESTOR);
    change("To (verified recipient)", RECIPIENT);
    fireEvent.click(await screen.findByRole("button", { name: /^Max/ }));
    await waitFor(() => expect(button("Force transfer")).toBeEnabled());
    fireEvent.click(button("Force transfer"));
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Force transfer" }),
    );
    await screen.findByText("Forced transfer: Confirmed");
    expect(blockchain.forcedTransfer).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      INVESTOR,
      RECIPIENT,
      "100",
    );
  });
  it("blocks a forced transfer from a still-verified holder", async () => {
    vi.mocked(blockchain.eligibility).mockResolvedValue(true);
    vi.spyOn(blockchain, "balance").mockResolvedValue(100n);
    await open("controls", "Token controls");
    change("From (revoked holder)", INVESTOR);
    change("To (verified recipient)", RECIPIENT);
    change("Units to move", "10");
    await waitFor(() =>
      expect(button("Force transfer")).toHaveAccessibleDescription(
        /still verified/,
      ),
    );
  });
  it("grants the compliance role", async () => {
    await open("controls", "Token controls");
    change("Grant the role to", RECIPIENT);
    await waitFor(() => expect(button("Grant role")).toBeEnabled());
    fireEvent.click(button("Grant role"));
    await screen.findByText("Grant compliance role: Confirmed");
    expect(blockchain.setComplianceRole).toHaveBeenCalledWith(
      provider,
      ISSUER,
      asset,
      RECIPIENT,
      true,
    );
  });
});

describe("Create fund", () => {
  function fill(supply = "10000", price = "0.001") {
    change("Fund name", asset.name);
    change("Symbol", "CPT");
    change("Total supply", supply);
    change("Price per unit", price);
  }
  it("hides creation for a wallet that is not an authorised issuer", async () => {
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: false,
    });
    renderApp("/issuer/create");
    await connect();
    await screen.findByText("Not an authorised issuer");
    expect(
      screen.queryByRole("button", { name: "Create fund" }),
    ).not.toBeInTheDocument();
  });
  it.each([
    ["1.5", "0.001", "Quantity must"],
    ["10000", "0", "Token price must"],
  ])(
    "rejects invalid supply or price (%s, %s)",
    async (supply, price, message) => {
      renderApp("/issuer/create");
      await connect();
      await screen.findByLabelText("Fund name");
      fill(supply, price);
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(button("Create fund")).toBeDisabled();
      expect(blockchain.createAsset).not.toHaveBeenCalled();
    },
  );
  it("shows pending, then the confirmed fund's contract addresses", async () => {
    let confirm!: (value: unknown) => void;
    const iface = new Interface(abis.factory);
    const event = iface.encodeEventLog(iface.getEvent("AssetCreated")!, [
      0n,
      TOKEN,
      SALE,
      ISSUER,
    ]);
    vi.spyOn(blockchain, "factory").mockReturnValue({
      interface: iface,
    } as never);
    const oldAddress = blockchain.config.AssetFactory;
    blockchain.config.AssetFactory = FACTORY;
    vi.mocked(blockchain.createAsset).mockResolvedValue({
      hash: HASH,
      wait: () => new Promise((resolve) => (confirm = resolve)),
    } as never);
    try {
      renderApp("/issuer/create");
      await connect();
      await screen.findByLabelText("Fund name");
      fill();
      expect(
        screen.getByText(/Creates CPT with 10,000 units/),
      ).toBeInTheDocument();
      await waitFor(() => expect(button("Create fund")).toBeEnabled());
      fireEvent.click(button("Create fund"));
      expect(
        await screen.findByText("Create fund: Pending"),
      ).toBeInTheDocument();
      expect(button("Create fund")).toBeDisabled();
      expect(screen.queryByText("Fund created")).not.toBeInTheDocument();
      await act(async () =>
        confirm({
          status: 1,
          hash: HASH,
          logs: [{ ...event, address: FACTORY }],
        }),
      );
      expect(await screen.findByText("Fund created")).toBeInTheDocument();
      expect(screen.getByLabelText("Created fund")).toHaveTextContent(
        "0x5000…0005",
      );
    } finally {
      blockchain.config.AssetFactory = oldAddress;
    }
  });
  it("does not claim success when creation reverts", async () => {
    vi.mocked(blockchain.createAsset).mockResolvedValue({
      hash: HASH,
      wait: vi.fn().mockResolvedValue({ hash: HASH, status: 0, logs: [] }),
    } as never);
    renderApp("/issuer/create");
    await connect();
    await screen.findByLabelText("Fund name");
    fill();
    await waitFor(() => expect(button("Create fund")).toBeEnabled());
    fireEvent.click(button("Create fund"));
    await screen.findByText("Create fund: Failed");
    expect(screen.queryByText("Fund created")).not.toBeInTheDocument();
  });
});
