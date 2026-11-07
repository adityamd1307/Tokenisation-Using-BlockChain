import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";
import { blockchain } from "../services/blockchain";
import * as history from "../services/history";
import * as registry from "../services/registry";
import type { FundAccess } from "../types";
import {
  accountState,
  asset,
  digital,
  INVESTOR,
  MockWallet,
  mockTransaction,
} from "./fixtures";

export const access = (overrides: Partial<FundAccess> = {}): FundAccess[] => [
  {
    assetId: "0",
    eligible: true,
    compliance: false,
    tokenAdmin: false,
    saleIssuer: false,
    ...overrides,
  },
  {
    assetId: "1",
    eligible: false,
    compliance: false,
    tokenAdmin: false,
    saleIssuer: false,
  },
];

/** Stubs every chain read and write; tests override what they exercise. */
export function mockChain(account = INVESTOR) {
  const provider = new MockWallet();
  provider.accounts = [account];
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
  vi.spyOn(blockchain, "access").mockResolvedValue(access());
  vi.spyOn(blockchain, "holdings").mockResolvedValue([
    { asset, balance: 100n, eligible: true },
    { asset: digital, balance: 50n, eligible: true },
  ]);
  vi.spyOn(blockchain, "eligibility").mockResolvedValue(true);
  vi.spyOn(blockchain, "issuerStatus").mockResolvedValue(false);
  vi.spyOn(history, "assetHistory").mockResolvedValue([]);
  vi.spyOn(registry, "investorRegistry").mockResolvedValue([]);
  vi.spyOn(registry, "issuerDirectory").mockResolvedValue([]);
  for (const name of [
    "buy",
    "transfer",
    "createAsset",
    "whitelist",
    "approve",
    "deposit",
    "manageSale",
    "authorizeIssuer",
    "restoreCompliance",
    "setPaused",
    "forcedTransfer",
    "setComplianceRole",
  ] as const)
    vi.spyOn(blockchain, name).mockResolvedValue(mockTransaction() as never);
  return provider;
}

export async function connect() {
  // The top bar's button; a page may show a second one in its connect prompt.
  fireEvent.click(screen.getAllByRole("button", { name: /Connect wallet/ })[0]);
  await waitFor(() => expect(blockchain.roles).toHaveBeenCalled());
}

export const change = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
