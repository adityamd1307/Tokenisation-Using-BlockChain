// Phase 4 §8.4: bounded, real event queries. A purchase's ERC-20 transfer is deduplicated.
import { Contract, type EventLog, type Log } from "ethers";
import type { Activity, Asset } from "../types";
import { Blockchain } from "./blockchain";

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
    const sets = await Promise.all([
      logs(token, token.filters.Transfer(), from, to),
      logs(sale, "*", from, to),
      ...(account
        ? []
        : [
            logs(token, token.filters.WhitelistUpdated(), from, to),
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
      }
    }
  }
  const purchases = new Set(
    rows
      .filter((r) => r.type === "Purchase")
      .map((r) => `${r.hash}:${r.to?.toLowerCase()}:${r.quantity}`),
  );
  const filtered = rows
    .filter((r) => {
      if (
        r.type === "Transfer" &&
        r.from?.toLowerCase() === asset.sale.toLowerCase() &&
        purchases.has(`${r.hash}:${r.to?.toLowerCase()}:${r.quantity}`)
      )
        return false;
      if (account)
        return (
          (r.type === "Transfer" || r.type === "Purchase") &&
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
