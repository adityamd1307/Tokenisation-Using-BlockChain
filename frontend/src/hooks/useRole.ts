import { useWallet } from "../context/WalletContext";
import { useSelectedFund } from "../context/FundContext";
import { useAccess } from "./data";
import type { FundAccess } from "../types";
import type { Tone } from "../components/ui/display";

export interface Workspace {
  /** Issuer dashboard: authorised issuer, or any per-fund issuer/agent/admin role. */
  issuer: boolean;
  /** Administration: the factory's platform administrator. */
  admin: boolean;
  /** Funds where the wallet can open the issuer dashboard. */
  managed: FundAccess[];
}

/** Which workspaces the connected wallet may see, from on-chain roles. */
export function useWorkspace(): Workspace & { loading: boolean } {
  const wallet = useWallet(),
    access = useAccess();
  const managed =
    access.data?.filter((a) => a.saleIssuer || a.compliance || a.tokenAdmin) ??
    [];
  return {
    issuer: !!wallet.roles?.issuer || managed.length > 0,
    admin: !!wallet.roles?.admin,
    managed,
    loading: !!wallet.account && (!wallet.roles || access.loading),
  };
}

/** The role badge: the connected wallet's standing in the selected fund. */
export function useRoleBadge():
  { label: string; tone: Tone; scope?: string } | undefined {
  const wallet = useWallet(),
    access = useAccess(),
    { fund } = useSelectedFund();
  if (!wallet.account || wallet.wrongNetwork || !wallet.roles) return undefined;
  if (wallet.roles.admin) return { label: "Platform admin", tone: "accent" };
  const own = access.data?.find((a) => a.assetId === fund?.id);
  const scope = fund?.symbol;
  if (own?.saleIssuer || own?.tokenAdmin)
    return { label: "Issuer", tone: "accent", scope };
  if (own?.compliance) return { label: "Agent", tone: "accent", scope };
  if (own?.eligible) return { label: "Investor", tone: "ok", scope };
  if (wallet.roles.issuer) return { label: "Issuer", tone: "accent" };
  if (!own && fund) return undefined;
  return { label: "Not verified", tone: "warn", scope };
}
