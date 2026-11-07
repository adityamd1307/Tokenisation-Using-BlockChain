// Registries the contracts do not store as lists. AssetToken has no investor
// enumeration and AssetFactory has no issuer list, so both are rebuilt from events
// and every row's current state is then read directly from the contract.
import { ZeroAddress, ZeroHash, type Contract, type EventLog } from "ethers";
import type { Asset, IssuerRow, RegistryRow } from "../types";
import { COMPLIANCE_ROLE, type Blockchain } from "./blockchain";
import { logs } from "./history";

async function scan(api: Blockchain, contract: Contract) {
  const tip = await api.provider.getBlockNumber();
  const events: EventLog[] = [];
  for (let from = api.config.deployBlock; from <= tip; from += 2000) {
    const found = await logs(contract, "*", from, Math.min(tip, from + 1999));
    events.push(...found.filter((log): log is EventLog => "args" in log));
  }
  return events;
}

async function batched<T, R>(items: T[], read: (item: T) => Promise<R>) {
  const result: R[] = [];
  for (let start = 0; start < items.length; start += 10)
    result.push(
      ...(await Promise.all(items.slice(start, start + 10).map(read))),
    );
  return result;
}

/**
 * Every address that was ever whitelisted, held units or was granted a role on
 * this token, with its current eligibility, balance and roles.
 */
export async function investorRegistry(
  api: Blockchain,
  asset: Asset,
): Promise<RegistryRow[]> {
  const token = api.token(asset);
  const seen = new Map<string, number | undefined>();
  const add = (value: unknown, block?: number) => {
    const key = String(value);
    if (!key || key === ZeroAddress) return;
    const known = seen.get(key);
    seen.set(key, block ?? known);
  };
  for (const event of await scan(api, token)) {
    const a = event.args;
    if (event.eventName === "WhitelistUpdated")
      add(a.investor, event.blockNumber);
    else if (event.eventName === "Transfer") {
      add(a.from);
      add(a.to);
    } else if (event.eventName === "RoleGranted") add(a.account);
  }
  return batched([...seen.entries()], async ([address, changedBlock]) => {
    const [eligible, balance, compliance, tokenAdmin] = await Promise.all([
      token.isWhitelisted(address) as Promise<boolean>,
      token.balanceOf(address) as Promise<bigint>,
      token.hasRole(COMPLIANCE_ROLE, address) as Promise<boolean>,
      token.hasRole(ZeroHash, address) as Promise<boolean>,
    ]);
    return { address, eligible, balance, compliance, tokenAdmin, changedBlock };
  });
}

/**
 * Investors holding units: excludes the sale contract's unsold inventory and the
 * issuer's unallocated supply, which are not investor positions.
 */
export function holderCount(rows: RegistryRow[], asset: Asset) {
  const excluded = [asset.sale, asset.issuer].map((a) => a.toLowerCase());
  return rows.filter(
    (row) => row.balance > 0n && !excluded.includes(row.address.toLowerCase()),
  ).length;
}

/** Every address the factory has authorised or revoked, with its current status. */
export async function issuerDirectory(api: Blockchain): Promise<IssuerRow[]> {
  const factory = api.factory();
  const latest = new Map<string, number>();
  for (const event of await scan(api, factory))
    if (["IssuerAuthorised", "IssuerRevoked"].includes(event.eventName))
      latest.set(String(event.args.issuer), event.blockNumber);
  return batched([...latest.entries()], async ([address, changedBlock]) => ({
    address,
    authorised: (await factory.authorisedIssuers(address)) as boolean,
    changedBlock,
  }));
}
