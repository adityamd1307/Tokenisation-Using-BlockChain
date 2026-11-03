import { Interface, isError } from "ethers";
import { abis } from "../config/contracts";
const interfaces = Object.values(abis).map((abi) => new Interface(abi));
const messages: Record<string, string> = {
  NotAdmin: "Only the platform administrator can manage issuers.",
  NotIssuer: "Only this asset’s issuer can manage its offering.",
  IssuerNotAuthorised: "This wallet is not authorised to create assets.",
  IssuerAlreadyAuthorised: "This issuer is already authorised.",
  AdminCannotBeIssuer: "The platform administrator cannot be an issuer.",
  AccessControlUnauthorizedAccount:
    "This wallet does not hold the required token role.",
  InvestorNotWhitelisted: "Your wallet is not approved for this asset.",
  SenderNotWhitelisted:
    "The sender is not whitelisted. The issuer must restore its eligibility.",
  RecipientNotWhitelisted:
    "The recipient is not whitelisted. The issuer must approve it first.",
  InsufficientInventory: "The offering has insufficient token inventory.",
  ERC20InsufficientBalance: "Insufficient token balance.",
  ERC20InsufficientAllowance:
    "Approve sufficient token spending before depositing.",
  SaleIsClosed: "This offering is permanently closed.",
  SaleNotClosed: "Close the offering before recovering unsold tokens.",
  IncorrectPayment: "Incorrect ETH payment. Refresh the asset and try again.",
  NoProceeds: "There are no proceeds to withdraw.",
  NoUnsoldTokens: "There are no unsold tokens to recover.",
  NoExcessETH: "There is no excess ETH to recover.",
  AssetNotFound: "This asset does not exist in the registry.",
};
export function rejected(error: any) {
  return (
    error?.code === 4001 ||
    isError(error, "ACTION_REJECTED") ||
    error?.info?.error?.code === 4001
  );
}
export function errorMessage(error: any): string {
  if (rejected(error))
    return "Request rejected in your wallet. No transaction was confirmed.";
  if (isError(error, "INSUFFICIENT_FUNDS"))
    return "Insufficient ETH for this payment and network fees.";
  if (error?.code === -32002)
    return "A wallet request is already open. Check your wallet.";
  const data = error?.data ?? error?.info?.error?.data;
  for (const iface of interfaces) {
    try {
      const parsed = iface.parseError(
        typeof data === "string" ? data : data?.data,
      );
      if (parsed)
        return (
          messages[parsed.name] ||
          `Contract rejected the request: ${parsed.name}.`
        );
    } catch {
      /* Try the next compiled ABI. */
    }
  }
  if (
    ["NETWORK_ERROR", "SERVER_ERROR", "TIMEOUT", "UNKNOWN_ERROR"].includes(
      error?.code,
    ) ||
    /fetch|ECONNREFUSED/i.test(error?.message || "")
  )
    return "RPC connection unavailable or request failed. Check the local node, network and deployment, then retry.";
  return (
    error?.shortMessage || error?.message || "The request failed. Please retry."
  );
}
