// Ported from main (PRs #3 and #4) to the redesigned UI on frontend-redesign.
// Assertions are unchanged except: renderApp mounting, "Connect wallet",
// "Label: Confirmed" status text, and mocking the per-fund access read.
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./render";
import { blockchain } from "../services/blockchain";
import { compliance } from "../services/compliance";
import {
  asset,
  INVESTOR,
  RECIPIENT,
  TOKEN,
  SALE,
  ISSUER,
  MockWallet,
  mockTransaction,
} from "./fixtures";
import { transferReason } from "../utils/compliance";
import { Interface } from "ethers";
import { abis } from "../config/contracts";
import { errorMessage } from "../utils/errors";
const regulated = { ...asset, identityRegistry: SALE, compliancePolicy: TOKEN };
const identity = {
  identityId: `0x${"aa".repeat(32)}`,
  country: 702,
  kycApproved: true,
  accredited: true,
  validUntil: 2000000000n,
  attestedBy: ISSUER,
  revoked: false,
  status: 0,
  trusted: true,
  chainTime: 1800000000n,
  operational: 0,
};
const policy = {
  maximum: 500n,
  accredited: true,
  allowed: [true, false, false],
  identityAdmin: false,
  attestor: false,
  policyAdmin: false,
};
let wallet: MockWallet;
async function connect() {
  fireEvent.click(screen.getAllByRole("button", { name: /Connect wallet/ })[0]);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Disconnect wallet" }),
    ).toBeInTheDocument(),
  );
}
function mount() {
  renderApp("/compliance");
}
beforeEach(() => {
  wallet = new MockWallet();
  window.ethereum = wallet;
  vi.spyOn(blockchain, "ready").mockResolvedValue();
  vi.spyOn(blockchain, "roles").mockResolvedValue({
    admin: false,
    issuer: false,
  });
  vi.spyOn(blockchain.provider, "getBalance").mockResolvedValue(10n ** 18n);
  vi.spyOn(blockchain, "assets").mockResolvedValue([regulated]);
  vi.spyOn(compliance, "state").mockResolvedValue(policy);
  vi.spyOn(compliance, "identity").mockResolvedValue(identity);
  vi.spyOn(blockchain, "access").mockResolvedValue([]);
});
describe("Compliance workspace", () => {
  it("shows real metadata and connected identity without administrator controls", async () => {
    mount();
    await connect();
    expect(
      await screen.findByText("Your investor identity"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Maximum wallet holdings"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Trust attestor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Register identity" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Update holding limit" }),
    ).not.toBeInTheDocument();
  });
  it("shows empty legacy state without invoking compliance reads", async () => {
    vi.spyOn(blockchain, "assets").mockResolvedValue([asset]);
    mount();
    await connect();
    expect(await screen.findByText("No regulated assets")).toBeInTheDocument();
    expect(compliance.state).not.toHaveBeenCalled();
    expect(compliance.identity).not.toHaveBeenCalled();
  });
  it("uses authoritative preflight, explains holding failure, and invalidates edited results", async () => {
    const check = vi.spyOn(compliance, "check").mockResolvedValue({
      reason: 5,
      identity,
      senderIdentity: identity,
      recipientPolicy: 0,
      policyTransfer: 5,
    });
    mount();
    await connect();
    await screen.findByLabelText("Transfer amount");
    fireEvent.change(screen.getByLabelText("Recipient"), {
      target: { value: RECIPIENT },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Check transfer eligibility" }),
    );
    expect(
      await screen.findByText("Recipient exceeds maximum wallet holdings"),
    ).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith(regulated, INVESTOR, RECIPIENT, "100");
    fireEvent.change(screen.getByLabelText("Transfer amount"), {
      target: { value: "50" },
    });
    expect(
      screen.queryByText("Recipient exceeds maximum wallet holdings"),
    ).not.toBeInTheDocument();
  });
  it("refreshes credential state on wallet switch and clears prior lookup/form state", async () => {
    vi.spyOn(compliance, "identity").mockImplementation(async (_a, who) => ({
      ...identity,
      status: who === RECIPIENT ? 4 : 0,
    }));
    mount();
    await connect();
    await screen.findByText("Your investor identity");
    fireEvent.change(screen.getByLabelText("Investor wallet"), {
      target: { value: INVESTOR },
    });
    await act(async () => {
      wallet.accounts = [RECIPIENT];
      wallet.emit("accountsChanged", [RECIPIENT]);
    });
    expect(
      await screen.findByText("KYC credential expired"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Investor wallet")).toHaveValue("");
    await waitFor(() =>
      expect(compliance.identity).toHaveBeenCalledWith(regulated, RECIPIENT),
    );
  });
  it("limits attestor management to registry admins and confirms the transaction", async () => {
    vi.spyOn(compliance, "state").mockResolvedValue({
      ...policy,
      identityAdmin: true,
    });
    const trust = vi
      .spyOn(compliance, "trust")
      .mockResolvedValue(mockTransaction());
    mount();
    await connect();
    await screen.findByLabelText("Attestor wallet");
    fireEvent.change(screen.getByLabelText("Attestor wallet"), {
      target: { value: RECIPIENT },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trust attestor" }));
    await waitFor(() =>
      expect(trust).toHaveBeenCalledWith(
        wallet,
        INVESTOR,
        regulated,
        RECIPIENT,
        true,
      ),
    );
    expect(await screen.findByText(/: Confirmed/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Register identity" }),
    ).not.toBeInTheDocument();
  });
  it("trusted attestor can load and renew an existing synthetic ID", async () => {
    vi.spyOn(compliance, "state").mockResolvedValue({
      ...policy,
      attestor: true,
    });
    const attest = vi
      .spyOn(compliance, "attest")
      .mockResolvedValue(mockTransaction());
    mount();
    await connect();
    await screen.findByLabelText("Synthetic identity ID");
    fireEvent.change(screen.getByLabelText("Investor wallet"), {
      target: { value: RECIPIENT },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load credential for renewal" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Synthetic identity ID")).toHaveValue(
        identity.identityId,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Renew identity" }));
    await waitFor(() =>
      expect(attest).toHaveBeenCalledWith(
        wallet,
        INVESTOR,
        regulated,
        RECIPIENT,
        expect.objectContaining({
          identityId: identity.identityId,
          country: "702",
        }),
        true,
      ),
    );
  });
  it("policy administrator submits policy changes through receipt handling", async () => {
    vi.spyOn(compliance, "state").mockResolvedValue({
      ...policy,
      policyAdmin: true,
    });
    const update = vi
      .spyOn(compliance, "updatePolicy")
      .mockResolvedValue(mockTransaction());
    mount();
    await connect();
    await screen.findByLabelText("New maximum wallet holdings");
    fireEvent.change(screen.getByLabelText("New maximum wallet holdings"), {
      target: { value: "750" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Update holding limit" }),
    );
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        wallet,
        INVESTOR,
        regulated,
        "setMaxWalletHolding",
        "750",
        false,
      ),
    );
  });
  it("blocks writes on the wrong network", async () => {
    vi.spyOn(compliance, "state").mockResolvedValue({
      ...policy,
      identityAdmin: true,
    });
    wallet.chain = "0x1";
    mount();
    await connect();
    expect(
      await screen.findByRole("button", { name: "Trust attestor" }),
    ).toBeDisabled();
  });
  it("decodes actual custom transfer errors", () => {
    const encoded = new Interface(abis.regulatedToken).encodeErrorResult(
      "TransferRestricted",
      [5],
    );
    expect(errorMessage({ data: encoded })).toBe(transferReason(5));
  });
});
