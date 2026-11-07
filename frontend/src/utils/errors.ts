// Every custom error in AssetFactory, AssetToken (incl. inherited OpenZeppelin errors)
// and AssetSale maps to a plain-English message. Raw RPC text, JSON and stack traces
// never reach the user: anything undecodable falls back to a generic sentence.
import {
  formatEther,
  id,
  Interface,
  isError,
  ZeroHash,
  type ErrorDescription,
} from "ethers";
import { abis } from "../config/contracts";
import { rpcError } from "../types";
import { transferReason } from "./compliance";

const interfaces = Object.values(abis).map((abi) => new Interface(abi));

// spec-v1 §5 D5: every token movement except forcedTransfer reverts while paused.
export const PAUSED =
  "This asset is paused by its issuer. No tokens can move until it is unpaused.";

const short = (value: unknown) => {
  const text = String(value);
  return /^0x[0-9a-fA-F]{40}$/.test(text)
    ? `${text.slice(0, 6)}…${text.slice(-4)}`
    : text;
};
const units = (value: unknown) => BigInt(String(value)).toLocaleString("en-US");
const roles: Record<string, string> = {
  [ZeroHash]: "token admin",
  [id("COMPLIANCE_ROLE")]: "compliance agent",
};

type Message = string | ((args: ErrorDescription["args"]) => string);
export const messages: Record<string, Message> = {
  // AssetFactory
  InvalidAdmin: "The factory has no platform administrator.",
  NotAdmin: "Only the platform administrator can do this.",
  InvalidIssuer: "Enter a valid, non-zero issuer address.",
  AdminCannotBeIssuer: "The platform administrator cannot also be an issuer.",
  IssuerAlreadyAuthorised: ([a]) =>
    `Address ${short(a)} is already an authorised issuer.`,
  IssuerNotAuthorised: ([a]) =>
    `Address ${short(a)} is not an authorised issuer.`,
  InvalidSupply: "Total supply must be greater than zero.",
  InvalidPrice: "Price per unit must be greater than zero.",
  AssetNotFound: ([assetId]) =>
    `Fund #${String(assetId)} does not exist in the registry.`,
  // AssetToken
  InvalidInitialSupply: "Total supply must be greater than zero.",
  InvalidInvestor: "Enter a valid, non-zero investor address.",
  SenderNotWhitelisted: ([a]) =>
    `Sender ${short(a)} is not verified for this fund. The issuer must restore its eligibility first.`,
  RecipientNotWhitelisted: ([a]) =>
    `Recipient ${short(a)} is not a verified investor in this fund.`,
  IssuerAdminRoleLocked:
    "The issuer’s token-admin role cannot be revoked or renounced.",
  ForcedTransferFromZeroAddress: "A forced transfer needs a source address.",
  ForcedTransferFromWhitelisted: ([a]) =>
    `Address ${short(a)} is still verified. Revoke its eligibility before a forced transfer.`,
  // OpenZeppelin Pausable (AUD-019)
  EnforcedPause: PAUSED,
  ExpectedPause: "This asset is not paused.",
  // OpenZeppelin AccessControl
  AccessControlUnauthorizedAccount: ([, role]) =>
    `This wallet does not hold the ${roles[String(role)] ?? "required"} role for this fund.`,
  AccessControlBadConfirmation:
    "A role can only be renounced by the wallet that holds it.",
  // OpenZeppelin ERC-20
  ERC20InsufficientBalance: ([, balance, needed]) =>
    `Insufficient balance: ${units(balance)} units held, ${units(needed)} needed.`,
  ERC20InsufficientAllowance: ([, allowance, needed]) =>
    `The approved amount is ${units(allowance)} units but ${units(needed)} are needed. Approve the full amount first.`,
  ERC20InvalidSender: "Tokens cannot be sent from the zero address.",
  ERC20InvalidReceiver: "Tokens cannot be sent to the zero address.",
  ERC20InvalidApprover: "An approval needs a non-zero owner address.",
  ERC20InvalidSpender: "An approval needs a non-zero spender address.",
  // AssetSale
  InvalidToken: "The offering has no token contract.",
  NotIssuer: "Only this fund’s issuer can manage its offering.",
  InvalidQuantity: "Enter a quantity greater than zero.",
  SaleIsClosed: "This offering is permanently closed.",
  SaleNotClosed: "Close the offering before recovering unsold units.",
  InvestorNotWhitelisted: () =>
    "Your wallet is not a verified investor in this fund.",
  InsufficientInventory: ([requested, available]) =>
    `Only ${units(available)} units are available; ${units(requested)} were requested.`,
  IncorrectPayment: ([expected, received]) =>
    `The payment must be exactly ${formatEther(expected)} ETH, but ${formatEther(received)} ETH was sent. Refresh and try again.`,
  NoProceeds: "There are no sale proceeds to withdraw.",
  WithdrawalFailed: "The issuer address did not accept the ETH payment.",
  NoUnsoldTokens: "There are no unsold units to recover.",
  NoExcessETH: "There is no excess ETH to recover.",
  SafeERC20FailedOperation: "The token transfer inside the sale failed.",
  // Regulated assets and subscription offerings (origin/main, PRs #3 and #4).
  InvalidCustody:
    "Only the asset issuer can authorise this platform’s matching subscription escrow.",
  SelfAttestation: "Trusted attestors cannot approve their own wallet.",
  AlreadyRegistered: "This wallet is already registered. Use renewal instead.",
  NotRegistered: "Investor identity is not registered.",
  InvalidIdentity:
    "Use a nonzero synthetic ID, a supported country and a future credential expiry.",
  NotAdministrator:
    "Only this asset’s policy administrator can change these settings.",
  AdministratorLocked: "The registry administrator’s role cannot be removed.",
  InvalidBinding: "The compliance policy is already bound to another token.",
  UnsupportedCountry: "This country is not supported by the demo policy.",
  InvalidSubscriptionFactory: "The subscription factory address is invalid.",
  WrongStage:
    "This action is unavailable in the offering’s current stage. Refresh its status.",
  InvalidAmount:
    "Enter a positive amount that matches the offering’s price and inventory limits.",
  InvalidConfiguration:
    "Check supply, price, caps and future subscription dates.",
  NotAssetIssuer:
    "Only the authorised issuer of this asset can create its offerings.",
  InventoryNotFunded:
    "The issuer must fully fund the offering before subscriptions open.",
  InvestorNotEligible:
    "Your wallet is not approved for this asset. Contact its issuer.",
  AlreadySettled:
    "This subscription is already settled. Refresh to view your entitlement.",
  NotSettled: "Settle your subscription before withdrawing or claiming.",
  NothingDue: "No balance is available for this action.",
  UnsupportedTokenBehavior:
    "The token transfer was incompatible. No funds were accepted by this transaction.",
  Insolvent: "Escrow reserves are insufficient. The transaction was reverted.",
  ReentrancyGuardReentrantCall:
    "The contract rejected a nested call. No changes were made.",
  OwnableUnauthorizedAccount: "Only the token owner can do this.",
  OwnableInvalidOwner: "The new owner address is invalid.",
  TransferRestricted: ([reason]) => transferReason(Number(reason)),
};

const GENERIC =
  "The transaction could not be completed. No changes were made on-chain.";

export function rejected(caught: unknown) {
  const error = rpcError(caught);
  return (
    error.code === 4001 ||
    isError(caught, "ACTION_REJECTED") ||
    error.info?.error?.code === 4001
  );
}

/** Decodes revert data from an ethers or wallet error into a known custom error. */
export function decodeRevert(caught: unknown): ErrorDescription | null {
  const error = rpcError(caught);
  const raw = error.data ?? error.info?.error?.data;
  const data =
    typeof raw === "string"
      ? raw
      : typeof raw === "object" && raw !== null && "data" in raw
        ? (raw as { data: unknown }).data
        : undefined;
  if (typeof data !== "string" || data.length < 10) return null;
  for (const iface of interfaces) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) return parsed;
    } catch {
      /* Try the next compiled ABI. */
    }
  }
  return null;
}

export function errorMessage(caught: unknown): string {
  if (rejected(caught))
    return "Request rejected in your wallet. No transaction was sent.";
  const error = rpcError(caught);
  if (isError(caught, "INSUFFICIENT_FUNDS"))
    return "Insufficient ETH for this payment and network fees.";
  if (error.code === -32002)
    return "A wallet request is already open. Check your wallet.";
  const parsed = decodeRevert(caught);
  if (parsed) {
    const message = messages[parsed.name];
    if (typeof message === "function") return message(parsed.args);
    return message ?? "The contract rejected this transaction.";
  }
  if (
    ["NETWORK_ERROR", "SERVER_ERROR", "TIMEOUT", "UNKNOWN_ERROR"].includes(
      String(error.code),
    ) ||
    /fetch|ECONNREFUSED/i.test(error.message || "")
  )
    return "The network connection failed. Check the node or RPC endpoint, then retry.";
  if (error.code === "CALL_EXCEPTION")
    return "The contract rejected this transaction without giving a reason.";
  // Our own pre-flight errors are plain Error objects with readable sentences. Anything
  // carrying an ethers/wallet code, JSON or a stack-like message gets the generic text.
  const message = error.message || "";
  if (
    error.code === undefined &&
    message &&
    message.length < 300 &&
    !/[{}[\]]|\bat\s+\S+\s+\(|0x[0-9a-f]{64,}/i.test(message)
  )
    return message;
  return GENERIC;
}
