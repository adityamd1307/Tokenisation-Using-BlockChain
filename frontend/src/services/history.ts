// Phase 4 §8.4: bounded, real event queries. The ERC-20 transfer inside a purchase or a
// forced transfer (D5, AUD-013) is deduplicated so each operation appears once, typed.
import { Contract, id, ZeroHash, type EventLog, type Log } from "ethers";
import type { Activity, Asset } from "../types";
import { Blockchain } from "./blockchain";

const COMPLIANCE_ROLE = id("COMPLIANCE_ROLE");
export function roleName(role: string) {
  if (role === ZeroHash) return "Token admin";
  if (role === COMPLIANCE_ROLE) return "Compliance agent";
  return `Role ${role.slice(0, 10)}…`;
}

async function logs(
  contract: Contract,
  filter: any,
  from: number,
  to: number,
): Promise<(EventLog | Log)[]> {
  try {
    return await contract.queryFilter(filter, from, to);
  } catch (error: any) {
    // Split only range/size-limit failures. Transport failures must surface promptly.
    const message = `${error?.message || ""} ${error?.info?.error?.message || ""}`;
    if (
      from >= to ||
      !/range|too many|limit|more than|response size/i.test(message)
    )
      throw error;
    const middle = Math.floor((from + to) / 2);
    return [
      ...(await logs(contract, filter, from, middle)),
      ...(await logs(contract, filter, middle + 1, to)),
    ];
  }
}
export async function assetHistory(
  api: Blockchain,
  asset: Asset,
  account?: string,
): Promise<Activity[]> {
  const tip = await api.provider.getBlockNumber();
  const rows: Activity[] = [];
  const factory = api.factory(),
    token = api.token(asset),
    sale = api.sale(asset);
  for (let from = api.config.deployBlock; from <= tip; from += 2000) {
    const to = Math.min(tip, from + 1999);
    // One token query returns Transfer, ForcedTransfer and WhitelistUpdated together.
    const sets = await Promise.all([
      logs(token, "*", from, to),
      logs(sale, "*", from, to),
      ...(account
        ? []
        : [
            logs(
              factory,
              factory.filters.AssetCreated(BigInt(asset.id)),
              from,
              to,
            ),
          ]),
    ]);
    for (const log of sets.flat()) {
      if (!("args" in log)) continue;
      const event = log as EventLog,
        a = event.args;
      const base = {
        id: `${event.transactionHash}:${event.index}`,
        asset: asset.symbol,
        hash: event.transactionHash,
        block: event.blockNumber,
        index: event.index,
      };
      switch (event.eventName) {
        case "Transfer":
          rows.push({
            ...base,
            type: "Transfer",
            quantity: a.value,
            from: a.from,
            to: a.to,
          });
          break;
        case "ForcedTransfer":
          rows.push({
            ...base,
            type: "Forced transfer",
            quantity: a.amount,
            from: a.from,
            to: a.to,
          });
          break;
        case "Purchased":
          rows.push({
            ...base,
            type: "Purchase",
            quantity: a.quantity,
            paid: a.paid,
            from: asset.sale,
            to: a.buyer,
          });
          break;
        case "AssetCreated":
          rows.push({
            ...base,
            type: "Asset created",
            quantity: asset.totalSupply,
            to: a.issuer,
          });
          break;
        case "WhitelistUpdated":
          rows.push({
            ...base,
            type: a.approved ? "Eligibility approved" : "Eligibility revoked",
            from: a.operator,
            to: a.investor,
          });
          break;
        case "Allocated":
          rows.push({
            ...base,
            type: "Inventory deposited",
            quantity: a.amount,
            from: asset.issuer,
            to: asset.sale,
          });
          break;
        case "ProceedsWithdrawn":
          rows.push({
            ...base,
            type: "Proceeds withdrawn",
            paid: a.amount,
            from: asset.sale,
            to: asset.issuer,
          });
          break;
        case "UnsoldTokensRecovered":
          rows.push({
            ...base,
            type: "Inventory recovered",
            quantity: a.amount,
            from: asset.sale,
            to: asset.issuer,
          });
          break;
        case "ExcessETHSwept":
          rows.push({
            ...base,
            type: "Excess ETH recovered",
            paid: a.amount,
            from: asset.sale,
            to: asset.issuer,
          });
          break;
        case "SaleClosed":
          rows.push({ ...base, type: "Offering closed", from: asset.issuer });
          break;
        // AUD-017: D5 pause (OpenZeppelin Pausable) and AccessControl role changes.
        case "Paused":
          rows.push({ ...base, type: "Paused", from: a.account });
          break;
        case "Unpaused":
          rows.push({ ...base, type: "Unpaused", from: a.account });
          break;
        case "RoleGranted":
        case "RoleRevoked":
          rows.push({
            ...base,
            type:
              event.eventName === "RoleGranted"
                ? "Role granted"
                : "Role revoked",
            detail: roleName(a.role),
            from: a.sender,
            to: a.account,
          });
          break;
      }
    }
  }
  const purchases = new Set(
    rows
      .filter((r) => r.type === "Purchase")
      .map((r) => `${r.hash}:${r.to?.toLowerCase()}:${r.quantity}`),
  );
  const forced = new Set(
    rows
      .filter((r) => r.type === "Forced transfer")
      .map(
        (r) =>
          `${r.hash}:${r.from?.toLowerCase()}:${r.to?.toLowerCase()}:${r.quantity}`,
      ),
  );
  const filtered = rows
    .filter((r) => {
      if (
        r.type === "Transfer" &&
        r.from?.toLowerCase() === asset.sale.toLowerCase() &&
        purchases.has(`${r.hash}:${r.to?.toLowerCase()}:${r.quantity}`)
      )
        return false;
      if (
        r.type === "Transfer" &&
        forced.has(
          `${r.hash}:${r.from?.toLowerCase()}:${r.to?.toLowerCase()}:${r.quantity}`,
        )
      )
        return false;
      if (account)
        return (
          ["Transfer", "Purchase", "Forced transfer"].includes(r.type) &&
          [r.from?.toLowerCase(), r.to?.toLowerCase()].includes(
            account.toLowerCase(),
          )
        );
      return true;
    })
    .sort((a, b) => b.block - a.block || b.index - a.index);
  const timestamps = new Map<number, number>();
  await Promise.all(
    [...new Set(filtered.map((r) => r.block))].map(async (number) => {
      try {
        const block = await api.provider.getBlock(number);
        if (block) timestamps.set(number, block.timestamp);
      } catch {
        /* The verified log still renders without a timestamp. */
      }
    }),
  );
  return filtered.map((row) => ({
    ...row,
    timestamp: timestamps.get(row.block),
  }));
}
