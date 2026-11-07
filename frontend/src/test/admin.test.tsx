import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockchain } from "../services/blockchain";
import * as registry from "../services/registry";
import { renderApp } from "./render";
import { change, connect, mockChain } from "./mocks";
import { ADMIN, INVESTOR, ISSUER, MockWallet, RECIPIENT } from "./fixtures";

let provider: MockWallet;
beforeEach(() => {
  provider = mockChain(ADMIN);
  vi.mocked(blockchain.roles).mockResolvedValue({ admin: true, issuer: false });
});
const button = (name: string) => screen.getByRole("button", { name });

describe("Administration", () => {
  it("restricts the page to the actual platform administrator", async () => {
    vi.mocked(blockchain.roles).mockResolvedValue({
      admin: false,
      issuer: false,
    });
    renderApp("/admin");
    await connect();
    await screen.findByText("Administrator access required");
    expect(
      screen.queryByRole("button", { name: "Authorise issuer" }),
    ).not.toBeInTheDocument();
  });
  it("checks an address and authorises it", async () => {
    renderApp("/admin");
    await connect();
    await screen.findByLabelText("Issuer address");
    change("Issuer address", ISSUER);
    await screen.findByText("Not authorised");
    await waitFor(() => expect(button("Authorise issuer")).toBeEnabled());
    fireEvent.click(button("Authorise issuer"));
    await screen.findByText("Authorise issuer: Confirmed");
    expect(blockchain.authorizeIssuer).toHaveBeenCalledWith(
      provider,
      ADMIN,
      ISSUER,
      true,
    );
  });
  it("blocks the administrator authorising itself (AUD-008)", async () => {
    renderApp("/admin");
    await connect();
    await screen.findByLabelText("Issuer address");
    change("Issuer address", ADMIN);
    await waitFor(() =>
      expect(button("Authorise issuer")).toHaveAccessibleDescription(
        "The platform administrator cannot also be an issuer.",
      ),
    );
  });
  it("lists issuers from events", async () => {
    vi.mocked(registry.issuerDirectory).mockResolvedValue([
      { address: ISSUER, authorised: true, changedBlock: 2 },
      { address: INVESTOR, authorised: false, changedBlock: 7 },
    ]);
    renderApp("/admin");
    await connect();
    const table = await screen.findByRole("table", { name: "Issuers" });
    expect(await within(table).findByText("Authorised")).toBeInTheDocument();
    expect(within(table).getByText("Revoked")).toBeInTheDocument();
    expect(table).toHaveTextContent("Block 7");
  });
  it("confirms revocation and clears the dialog when the wallet changes", async () => {
    vi.mocked(blockchain.issuerStatus).mockResolvedValue(true);
    renderApp("/admin");
    await connect();
    await screen.findByLabelText("Issuer address");
    change("Issuer address", ISSUER);
    await screen.findByText("Authorised issuer");
    fireEvent.click(button("Revoke authorisation"));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Existing asset-token and sale contracts are not automatically deleted or frozen",
    );
    expect(blockchain.authorizeIssuer).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Revoke",
      }),
    );
    await screen.findByText("Revoke issuer: Confirmed");
    expect(blockchain.authorizeIssuer).toHaveBeenCalledWith(
      provider,
      ADMIN,
      ISSUER,
      false,
    );
    await waitFor(() => expect(button("Revoke authorisation")).toBeEnabled());
    fireEvent.click(button("Revoke authorisation"));
    act(() => {
      provider.accounts = [RECIPIENT];
      provider.emit("accountsChanged", [RECIPIENT]);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
