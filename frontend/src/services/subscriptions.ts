import {
  BrowserProvider,
  Contract,
  keccak256,
  type ContractRunner,
  type EventLog,
  type TransactionResponse,
} from "ethers";
import { abis } from "../config/contracts";
import { Blockchain, blockchain } from "./blockchain";
import { logs as boundedLogs } from "./history";
import type { Activity, Asset, WalletProvider } from "../types";
import { address, quantity } from "../utils/validation";
import {
  offeringArgs,
  parseUSD,
  type OfferingInput,
} from "../utils/subscription";

export interface Offering {
  address: string;
  assetId: string;
  issuer: string;
  paymentToken: string;
  supply: bigint;
  price: bigint;
  softCap: bigint;
  hardCap: bigint;
  start: bigint;
  end: bigint;
  state: number;
  demand: bigint;
  subscribers: bigint;
  deposited: bigint;
  inventory: bigint;
  guaranteed: bigint;
  recognized: bigint;
  withdrawn: bigint;
  recoverable: bigint;
  settledCount: bigint;
  finalized: boolean;
  chainTime: bigint;
}
export interface SubscriptionAccount {
  balance: bigint;
  allowance: bigint;
  commitment: bigint;
  allocation: bigint;
  accepted: bigint;
  refund: bigint;
  settled: boolean;
  claimed: boolean;
  eligible: boolean;
  offeringEligible: boolean;
  paused: boolean;
  assetBalance: bigint;
  assetAllowance: bigint;
}
export class Subscriptions {
  constructor(readonly api: Blockchain) {}
  get enabled() {
    return !!this.api.config.SubscriptionFactory && !!this.api.config.MockUSD;
  }
  factory(runner: ContractRunner = this.api.provider) {
    if (!this.enabled)
      throw new Error(
        "Subscription deployment is not configured for this network.",
      );
    return new Contract(
      address(this.api.config.SubscriptionFactory!),
      abis.subscriptionFactory,
      runner,
    );
  }
  offering(at: string, runner: ContractRunner = this.api.provider) {
    return new Contract(address(at), abis.offering, runner);
  }
  usd(runner: ContractRunner = this.api.provider) {
    return new Contract(address(this.api.config.MockUSD!), abis.usd, runner);
  }

  async ready(
    provider = this.api.provider as Blockchain["provider"] | BrowserProvider,
  ) {
    const config = this.api.config;
    const chain = await provider.getNetwork();
    if (chain.chainId !== BigInt(config.chainId))
      throw new Error("Wrong network for subscription deployment.");
    for (const [at, hash] of [
      [config.AssetFactory, config.runtimeCodeHash],
      [config.SubscriptionFactory, config.subscriptionFactoryCodeHash],
      [config.MockUSD, config.mockUSDCodeHash],
    ]) {
      if (!at || !hash)
        throw new Error(
          "Subscription deployment fingerprints are missing. Run the subscription deployment script.",
        );
      const code = await provider.getCode(at);
      if (code === "0x" || keccak256(code) !== hash)
        throw new Error(
          "Subscription deployment does not match this blockchain. Redeploy or select the correct wallet network.",
        );
    }
    if (
      config.deployBlockHash &&
      (await provider.getBlock(config.deployBlock))?.hash !==
        config.deployBlockHash
    )
      throw new Error("Deployment belongs to another blockchain session.");
    const f = this.factory(provider);
    if (
      (await f.assetFactory()).toLowerCase() !==
        config.AssetFactory.toLowerCase() ||
      (await f.paymentToken()).toLowerCase() !== config.MockUSD!.toLowerCase()
    )
      throw new Error(
        "Subscription registry does not match the configured asset factory and currency.",
      );
  }
  async signer(wallet: WalletProvider, account: string) {
    await this.ready();
    const provider = new BrowserProvider(wallet, "any");
    await this.ready(provider);
    const [chain, accounts] = await Promise.all([
      wallet.request({ method: "eth_chainId" }),
      wallet.request({ method: "eth_accounts" }),
    ]);
    if (
      BigInt(chain) !== BigInt(this.api.config.chainId) ||
      accounts[0]?.toLowerCase() !== account.toLowerCase()
    )
      throw new Error(
        "Wallet account or network changed. Review the form and retry.",
      );
    return provider.getSigner(account);
  }
  async get(at: string): Promise<Offering> {
    await this.ready();
    if (!(await this.factory().isOffering(address(at))))
      throw new Error("Offering is not registered on this platform.");
    const o = this.offering(at);
    const [
      assetId,
      issuer,
      paymentToken,
      supply,
      price,
      softCap,
      hardCap,
      start,
      end,
      state,
      demand,
      subscribers,
      deposited,
      guaranteed,
      recognized,
      withdrawn,
      recoverable,
      settledCount,
      finalized,
      assetToken,
      block,
    ] = await Promise.all([
      this.factory().assetIdOf(at),
      o.issuer(),
      o.paymentToken(),
      o.tokenSupplyForSale(),
      o.tokenPrice(),
      o.softCap(),
      o.hardCap(),
      o.subscriptionStart(),
      o.subscriptionEnd(),
      o.state(),
      o.totalCommitments(),
      o.subscriberCount(),
      o.depositedInventory(),
      o.guaranteedAcceptedFunding(),
      o.recognizedProceeds(),
      o.proceedsWithdrawn(),
      o.recoverableTokens(),
      o.settledCount(),
      o.finalized(),
      o.assetToken(),
      this.api.provider.getBlock("latest"),
    ]);
    const inventory: bigint = await new Contract(
      assetToken,
      abis.token,
      this.api.provider,
    ).balanceOf(at);
    return {
      address: at,
      assetId: assetId.toString(),
      issuer,
      paymentToken,
      supply,
      price,
      softCap,
      hardCap,
      start,
      end,
      state: Number(state),
      demand,
      subscribers,
      deposited,
      inventory,
      guaranteed,
      recognized,
      withdrawn,
      recoverable,
      settledCount,
      finalized,
      chainTime: BigInt(block!.timestamp),
    };
  }
  async list(
    offset = 0,
    limit = 24,
  ): Promise<{ items: Offering[]; hasMore: boolean }> {
    if (!this.enabled) return { items: [], hasMore: false };
    await this.ready();
    const count: bigint = await this.factory().offeringCount();
    const addresses: string[] = [];
    for (let i = BigInt(offset); i < count && i < BigInt(offset + limit); i++)
      addresses.push(await this.factory().offeringAt(i));
    const items: Offering[] = [];
    for (let i = 0; i < addresses.length; i += 4)
      items.push(
        ...(await Promise.all(
          addresses.slice(i, i + 4).map((at) => this.get(at)),
        )),
      );
    return { items, hasMore: BigInt(offset + items.length) < count };
  }
  async account(
    o: Offering,
    asset: Asset,
    who: string,
  ): Promise<SubscriptionAccount> {
    const c = this.offering(o.address),
      token = this.api.token(asset),
      usd = this.usd();
    const [
      balance,
      allowance,
      commitment,
      e,
      eligible,
      offeringEligible,
      paused,
      assetBalance,
      assetAllowance,
    ] = await Promise.all([
      usd.balanceOf(who),
      usd.allowance(who, o.address),
      c.commitments(who),
      c.entitlements(who),
      token.isWhitelisted(who),
      token.isWhitelisted(o.address),
      token.paused(),
      token.balanceOf(who),
      token.allowance(who, o.address),
    ]);
    const final = o.finalized ? await c.allocationOf(who) : [0n, 0n, 0n];
    return {
      balance,
      allowance,
      commitment,
      allocation: final[0],
      accepted: final[1],
      refund: e.settled ? e.refund : final[2],
      settled: e.settled,
      claimed: e.claimed,
      eligible,
      offeringEligible,
      paused,
      assetBalance,
      assetAllowance,
    };
  }
  async create(
    wallet: WalletProvider,
    who: string,
    asset: Asset,
    input: OfferingInput,
  ): Promise<TransactionResponse> {
    const block = await this.api.provider.getBlock("latest");
    const args = offeringArgs(input, BigInt(block!.timestamp));
    if (args[0] > asset.totalSupply)
      throw new Error("Offered supply exceeds the asset's fixed supply.");
    return this.factory(await this.signer(wallet, who)).createOffering(
      BigInt(asset.id),
      ...args,
    );
  }
  async action(
    wallet: WalletProvider,
    who: string,
    at: string,
    operation:
      | "approveUSD"
      | "commit"
      | "approveInventory"
      | "deposit"
      | "whitelistOffering"
      | "finalizeOffering"
      | "settleSubscription"
      | "withdrawRefund"
      | "claimTokens"
      | "withdrawProceeds"
      | "recoverUnsoldTokens",
    amount?: string,
  ): Promise<TransactionResponse> {
    const o = await this.get(at),
      asset = await this.api.asset(o.assetId),
      signer = await this.signer(wallet, who),
      c = this.offering(at, signer);
    if (operation === "approveUSD" || operation === "commit") {
      const value = parseUSD(amount || "");
      if (value % o.price !== 0n)
        throw new Error(
          "Commitment must be an exact multiple of the token price.",
        );
      if (o.state !== 1) throw new Error("Subscriptions are not open.");
      return operation === "approveUSD"
        ? this.usd(signer).approve(at, value)
        : c.commit(value);
    }
    if (operation === "approveInventory")
      return this.api.token(asset, signer).approve(at, quantity(amount || ""));
    if (operation === "deposit")
      return c.depositOfferingTokens(quantity(amount || ""));
    if (operation === "whitelistOffering")
      return asset.identityRegistry
        ? this.api.token(asset, signer).registerSubscriptionEscrow(at)
        : this.api.token(asset, signer).setWhitelisted(at, true);
    if (operation === "claimTokens") {
      const allocation = await c.allocationOf(who);
      await this.api.preflight(asset, at, who, allocation[0]);
    }
    return c[operation]();
  }
  async history(
    o: Offering,
    asset: Asset,
    before?: number,
  ): Promise<{ rows: Activity[]; next?: number }> {
    const tip = before ?? (await this.api.provider.getBlockNumber());
    const bottom =
      this.api.config.subscriptionDeployBlock ?? this.api.config.deployBlock;
    if (tip < bottom) return { rows: [] };
    const from = Math.max(bottom, tip - 1999);
    const eventLogs = await boundedLogs(
      this.offering(o.address),
      "*",
      from,
      tip,
    );
    const created = await boundedLogs(
      this.factory(),
      this.factory().filters.OfferingCreated(null, BigInt(asset.id)),
      from,
      tip,
    );
    const rows: Activity[] = [];
    for (const raw of [...eventLogs, ...created]) {
      if (!("args" in raw)) continue;
      const e = raw as EventLog,
        a = e.args;
      if (
        e.eventName === "OfferingCreated" &&
        a.offering.toLowerCase() !== o.address.toLowerCase()
      )
        continue;
      const row: Activity = {
        id: `${e.transactionHash}:${e.index}`,
        hash: e.transactionHash,
        block: e.blockNumber,
        index: e.index,
        asset: asset.symbol,
        type: e.eventName,
        currency: "mUSD",
      };
      if (e.eventName === "OfferingCreated") {
        row.type = "Subscription offering created";
        row.from = o.issuer;
      }
      if (e.eventName === "SubscriptionCommitted") {
        row.type = "Subscription committed";
        row.from = a.investor;
        row.paid = a.amount;
      }
      if (e.eventName === "OfferingFinalized")
        row.type = a.successful ? "Offering successful" : "Offering failed";
      if (e.eventName === "AllocationSettled") {
        row.type = "Allocation settled";
        row.to = a.investor;
        row.quantity = a.allocation;
        row.paid = a.accepted;
      }
      if (e.eventName === "RefundWithdrawn") {
        row.type = "Refund withdrawn";
        row.to = a.investor;
        row.paid = a.amount;
      }
      if (e.eventName === "TokensClaimed") {
        row.type = "Tokens claimed";
        row.to = a.investor;
        row.quantity = a.amount;
      }
      if (e.eventName === "ProceedsWithdrawn") {
        row.type = "Subscription proceeds withdrawn";
        row.to = o.issuer;
        row.paid = a.amount;
      }
      if (["InventoryDeposited", "InventoryRecovered"].includes(e.eventName)) {
        row.type =
          e.eventName === "InventoryDeposited"
            ? "Offering inventory deposited"
            : "Offering inventory recovered";
        row.quantity = a.amount;
      }
      rows.push(row);
    }
    return {
      rows: rows.sort((a, b) => b.block - a.block || b.index - a.index),
      next: from > bottom ? from - 1 : undefined,
    };
  }
}
export const subscriptions = new Subscriptions(blockchain);
