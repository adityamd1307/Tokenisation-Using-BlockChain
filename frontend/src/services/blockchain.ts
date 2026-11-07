import { transferReason } from "../utils/compliance";
// Phase 4 §§3, 10: public reads use the configured RPC; signing is wallet-only.
import {
  BrowserProvider,
  Contract,
  FetchRequest,
  id,
  JsonRpcProvider,
  keccak256,
  ZeroHash,
  type ContractRunner,
} from "ethers";
import { abis, deployment, type Deployment } from "../config/contracts";
import { targetNetwork } from "../config/networks";
import type {
  Asset,
  AssetAccount,
  FundAccess,
  Roles,
  WalletProvider,
} from "../types";

/** AssetToken.COMPLIANCE_ROLE; DEFAULT_ADMIN_ROLE is ZeroHash (OpenZeppelin). */
export const COMPLIANCE_ROLE = id("COMPLIANCE_ROLE");
import {
  address,
  creationArgs,
  payment,
  quantity,
  type CreateAssetInput,
} from "../utils/validation";
import { PAUSED } from "../utils/errors";

export class Blockchain {
  constructor(
    readonly provider: JsonRpcProvider,
    readonly config: Deployment = deployment,
  ) {}
  factory(runner: ContractRunner = this.provider) {
    return new Contract(
      address(this.config.AssetFactory),
      this.config.regulatedFactory ? abis.regulatedFactory : abis.factory,
      runner,
    );
  }
  token(asset: Asset, runner: ContractRunner = this.provider) {
    return new Contract(
      asset.token,
      asset.identityRegistry ? abis.regulatedToken : abis.token,
      runner,
    );
  }
  sale(asset: Asset, runner: ContractRunner = this.provider) {
    return new Contract(asset.sale, abis.sale, runner);
  }

  async ready(provider: JsonRpcProvider | BrowserProvider = this.provider) {
    if (!this.config.AssetFactory)
      throw new Error(
        "Contracts are not configured. Start the local blockchain and run npm run deploy:local, then restart the frontend.",
      );
    const chain = await provider.getNetwork();
    if (chain.chainId !== BigInt(this.config.chainId))
      throw new Error(
        "The RPC is on the wrong network. Check the wallet network and VITE_RPC_URL.",
      );
    const code = await provider.getCode(this.config.AssetFactory);
    if (code === "0x")
      throw new Error(
        "Factory deployment not found. The local chain may have reset. Redeploy contracts and restart the frontend.",
      );
    if (
      this.config.runtimeCodeHash &&
      keccak256(code) !== this.config.runtimeCodeHash
    )
      throw new Error(
        "Factory bytecode differs from this deployment. Regenerate frontend configuration.",
      );
    if (this.config.deployBlockHash) {
      const block = await provider.getBlock(this.config.deployBlock);
      if (block?.hash !== this.config.deployBlockHash)
        throw new Error(
          "Deployment belongs to an earlier blockchain session. Redeploy and restart the frontend.",
        );
    }
  }
  async roles(account: string): Promise<Roles> {
    await this.ready();
    const factory = this.factory();
    const [admin, issuer] = await Promise.all([
      factory.admin(),
      factory.authorisedIssuers(account),
    ]);
    return { admin: admin.toLowerCase() === account.toLowerCase(), issuer };
  }
  async issuerStatus(account: string): Promise<boolean> {
    await this.ready();
    return this.factory().authorisedIssuers(address(account));
  }
  async asset(id: string): Promise<Asset> {
    if (!/^\d+$/.test(id)) throw new Error("Invalid asset ID.");
    const a = await this.factory().getAsset(BigInt(id));
    const base = {
      id: a.assetId.toString(),
      name: a.name,
      symbol: a.symbol,
      description: a.description,
      category: Number(a.assetType),
      totalSupply: a.totalSupply,
      token: a.tokenContract,
      sale: a.saleContract,
      issuer: a.issuerAddress,
    };
    const sale = new Contract(base.sale, abis.sale, this.provider);
    // AUD-019: paused() exists on both token kinds (constant false on regulated tokens).
    const token = new Contract(base.token, abis.token, this.provider);
    const [price, inventory, closed, proceeds, saleEth, paused] =
      await Promise.all([
        sale.pricePerToken(),
        sale.availableTokens(),
        sale.saleClosed(),
        sale.unclaimedProceeds(),
        this.provider.getBalance(base.sale),
        token.paused(),
      ]);
    let modules: { identityRegistry?: string; compliancePolicy?: string } = {};
    if (this.config.regulatedFactory) {
      const m = await this.factory().modules(BigInt(id));
      if (BigInt(m.identityRegistry) !== 0n)
        modules = {
          identityRegistry: m.identityRegistry,
          compliancePolicy: m.compliance,
        };
    }
    return {
      ...base,
      ...modules,
      price,
      inventory,
      closed,
      proceeds,
      saleEth,
      paused,
    };
  }
  async assets(): Promise<Asset[]> {
    await this.ready();
    const count: bigint = await this.factory().getAssetCount();
    const result: Asset[] = [];
    // Bound concurrent calls; do not convert token quantities or registry IDs to floats.
    for (let start = 0n; start < count; start += 10n) {
      const ids = [];
      for (let id = start; id < count && id < start + 10n; id++)
        ids.push(id.toString());
      result.push(...(await Promise.all(ids.map((id) => this.asset(id)))));
    }
    return result;
  }
  async account(asset: Asset, account: string): Promise<AssetAccount> {
    const token = this.token(asset);
    if (asset.identityRegistry) {
      const [balance, eligible, saleEligible, allowance] = await Promise.all([
        token.balanceOf(account),
        token.isWhitelisted(account),
        token.isWhitelisted(asset.sale),
        token.allowance(account, asset.sale),
      ]);
      return {
        balance,
        eligible,
        saleEligible,
        allowance,
        compliance: false,
        tokenAdmin: false,
      };
    }
    const [complianceRole, adminRole] = await Promise.all([
      token.COMPLIANCE_ROLE(),
      token.DEFAULT_ADMIN_ROLE(),
    ]);
    const [balance, eligible, saleEligible, allowance, compliance, tokenAdmin] =
      await Promise.all([
        token.balanceOf(account),
        token.isWhitelisted(account),
        token.isWhitelisted(asset.sale),
        token.allowance(account, asset.sale),
        token.hasRole(complianceRole, account),
        token.hasRole(adminRole, account),
      ]);
    return {
      balance,
      eligible,
      saleEligible,
      allowance,
      compliance,
      tokenAdmin,
    };
  }
  async balance(asset: Asset, holder: string): Promise<bigint> {
    return this.token(asset).balanceOf(address(holder));
  }
  async eligibility(asset: Asset, account: string): Promise<boolean> {
    return this.token(asset).isWhitelisted(address(account));
  }
  async holdings(assets: Asset[], account: string) {
    return Promise.all(
      assets.map(async (asset) => {
        const token = this.token(asset);
        const [balance, eligible] = await Promise.all([
          token.balanceOf(account),
          token.isWhitelisted(account),
        ]);
        return {
          asset,
          balance: balance as bigint,
          eligible: eligible as boolean,
        };
      }),
    );
  }
  /** Per-fund roles for navigation and the role badge (spec-v1 §3, Phase 2 delegation). */
  async access(assets: Asset[], account: string): Promise<FundAccess[]> {
    return Promise.all(
      assets.map(async (asset) => {
        const token = this.token(asset);
        // Regulated tokens have no AccessControl roles; their compliance is managed
        // through the identity registry and policy contracts instead.
        const [eligible, compliance, tokenAdmin] = await Promise.all([
          token.isWhitelisted(account),
          asset.identityRegistry
            ? false
            : token.hasRole(COMPLIANCE_ROLE, account),
          asset.identityRegistry ? false : token.hasRole(ZeroHash, account),
        ]);
        return {
          assetId: asset.id,
          eligible: eligible as boolean,
          compliance: compliance as boolean,
          tokenAdmin: tokenAdmin as boolean,
          saleIssuer: asset.issuer.toLowerCase() === account.toLowerCase(),
        };
      }),
    );
  }
  async signer(wallet: WalletProvider, expectedAccount: string) {
    await this.ready();
    const [chain, accounts] = await Promise.all([
      wallet.request({ method: "eth_chainId" }),
      wallet.request({ method: "eth_accounts" }),
    ]);
    if (BigInt(chain) !== BigInt(this.config.chainId))
      throw new Error(
        "Wrong network. Switch to the configured network before submitting.",
      );
    if (
      !accounts[0] ||
      accounts[0].toLowerCase() !== expectedAccount.toLowerCase()
    )
      throw new Error("Wallet account changed. Review the form and try again.");
    // Subscription/compliance work (origin/main): a regulated deployment must carry a runtime code hash,
    // so the wallet-side check below always compares factory bytecode.
    if (this.config.regulatedFactory && !this.config.runtimeCodeHash)
      throw new Error(
        "Wallet deployment does not match the configured regulated factory.",
      );
    // AUD-030: two local chains can share an ID and deterministic addresses.
    // Validate the signing RPC against the same deployment fingerprint as reads.
    const provider = new BrowserProvider(wallet, "any");
    await this.ready(provider);
    const [currentChain, currentAccounts] = await Promise.all([
      wallet.request({ method: "eth_chainId" }),
      wallet.request({ method: "eth_accounts" }),
    ]);
    if (BigInt(currentChain) !== BigInt(this.config.chainId))
      throw new Error(
        "Wrong network. Review the wallet network and try again.",
      );
    if (currentAccounts[0]?.toLowerCase() !== expectedAccount.toLowerCase())
      throw new Error("Wallet account changed. Review the form and try again.");
    return provider.getSigner(expectedAccount);
  }
  async authorizeIssuer(
    wallet: WalletProvider,
    account: string,
    issuer: string,
    approved: boolean,
  ) {
    const to = address(issuer);
    if (!(await this.roles(account)).admin)
      throw new Error("Only the platform administrator can manage issuers.");
    const factory = this.factory(await this.signer(wallet, account));
    return approved ? factory.authorizeIssuer(to) : factory.revokeIssuer(to);
  }
  async createAsset(
    wallet: WalletProvider,
    account: string,
    input: CreateAssetInput,
    regulated?: { maximum: string; accredited: boolean },
  ) {
    const args = creationArgs(input);
    if (!(await this.roles(account)).issuer)
      throw new Error("This wallet is not authorised to create assets.");
    if (regulated) {
      if (!this.config.regulatedFactory)
        throw new Error("Regulated issuance is not configured.");
      return this.factory(
        await this.signer(wallet, account),
      ).createRegulatedAsset([
        ...args,
        quantity(regulated.maximum),
        regulated.accredited,
      ]);
    }
    return this.factory(await this.signer(wallet, account)).createAsset(
      ...args,
    );
  }
  async whitelist(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    investor: string,
    approved: boolean,
  ) {
    if (asset.identityRegistry)
      throw new Error("Manage credentials and policies in Compliance.");
    const to = address(investor);
    if (!(await this.account(asset, account)).compliance)
      throw new Error("This wallet does not hold the token compliance role.");
    return this.token(asset, await this.signer(wallet, account)).setWhitelisted(
      to,
      approved,
    );
  }
  async restoreCompliance(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
  ) {
    const token = this.token(asset);
    const role = await token.COMPLIANCE_ROLE();
    return this.token(asset, await this.signer(wallet, account)).grantRole(
      role,
      account,
    );
  }
  async approve(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    value: string,
  ) {
    const amount = quantity(value);
    return this.token(asset, await this.signer(wallet, account)).approve(
      asset.sale,
      amount,
    );
  }
  async deposit(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    value: string,
  ) {
    const amount = quantity(value);
    const [fresh, state] = await Promise.all([
      this.asset(asset.id),
      this.account(asset, account),
    ]);
    if (fresh.closed) throw new Error("This offering is permanently closed.");
    if (fresh.paused) throw new Error(PAUSED);
    if (!state.saleEligible || !state.eligible)
      throw new Error(
        "Whitelist both the issuer and sale contract before depositing.",
      );
    if (state.balance < amount)
      throw new Error("Insufficient issuer token balance.");
    if (state.allowance < amount)
      throw new Error("Approve sufficient token spending before depositing.");
    return this.sale(asset, await this.signer(wallet, account)).allocate(
      amount,
    );
  }
  async buy(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    value: string,
  ) {
    const amount = quantity(value);
    const [fresh, state] = await Promise.all([
      this.asset(asset.id),
      this.account(asset, account),
    ]);
    if (fresh.closed) throw new Error("This offering is permanently closed.");
    if (fresh.paused) throw new Error(PAUSED);
    await this.preflight(asset, asset.sale, account, amount);
    if (!state.eligible)
      throw new Error("Your wallet is not approved for this asset.");
    if (!state.saleEligible)
      throw new Error(
        "The sale contract is not whitelisted. Contact the issuer.",
      );
    if (amount > fresh.inventory)
      throw new Error("The offering has insufficient token inventory.");
    const cost = payment(amount, fresh.price);
    if ((await this.provider.getBalance(account)) < cost)
      throw new Error("Insufficient ETH for this payment.");
    return this.sale(asset, await this.signer(wallet, account)).buyTokens(
      amount,
      { value: cost },
    );
  }
  async transfer(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    recipient: string,
    value: string,
  ) {
    const to = address(recipient),
      amount = quantity(value);
    const [state, approved, fresh] = await Promise.all([
      this.account(asset, account),
      this.eligibility(asset, to),
      this.asset(asset.id),
    ]);
    if (fresh.paused) throw new Error(PAUSED);
    await this.preflight(asset, account, to, amount);
    if (!asset.identityRegistry && !state.eligible)
      throw new Error("Your wallet is not approved to send this asset.");
    if (!asset.identityRegistry && !approved)
      throw new Error(
        "This recipient is not authorised to hold the selected asset. The issuer must approve the recipient before this transfer can succeed.",
      );
    if (amount > state.balance) throw new Error("Insufficient token balance.");
    return this.token(asset, await this.signer(wallet, account)).transfer(
      to,
      amount,
    );
  }
  /** spec-v1 §5 D5: `pause()` / `unpause()`, caller DEFAULT_ADMIN_ROLE. */
  async setPaused(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    paused: boolean,
  ) {
    const [state, fresh] = await Promise.all([
      this.account(asset, account),
      this.asset(asset.id),
    ]);
    if (!state.tokenAdmin)
      throw new Error(
        "Only a token admin of this fund can pause or unpause it.",
      );
    if (fresh.paused === paused)
      throw new Error(
        paused ? "This asset is already paused." : "This asset is not paused.",
      );
    const token = this.token(asset, await this.signer(wallet, account));
    return paused ? token.pause() : token.unpause();
  }
  /**
   * spec-v1 §5 D5 `forcedTransfer(from, to, amount)`, caller DEFAULT_ADMIN_ROLE:
   * `from` must be revoked (not whitelisted), `to` whitelisted, amount ≤ balance.
   */
  async forcedTransfer(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    source: string,
    recipient: string,
    value: string,
  ) {
    const from = address(source),
      to = address(recipient),
      amount = quantity(value);
    const [state, fromEligible, toEligible, balance] = await Promise.all([
      this.account(asset, account),
      this.eligibility(asset, from),
      this.eligibility(asset, to),
      this.token(asset).balanceOf(from) as Promise<bigint>,
    ]);
    if (!state.tokenAdmin)
      throw new Error("Only a token admin of this fund can force a transfer.");
    if (fromEligible)
      throw new Error(
        "The source address is still verified. Revoke its eligibility before a forced transfer.",
      );
    if (!toEligible)
      throw new Error("The recipient is not a verified investor in this fund.");
    if (amount > balance)
      throw new Error(
        `The source address holds only ${balance.toLocaleString("en-US")} units.`,
      );
    return this.token(asset, await this.signer(wallet, account)).forcedTransfer(
      from,
      to,
      amount,
    );
  }
  /** Phase 2 delegation: grant or revoke COMPLIANCE_ROLE (caller DEFAULT_ADMIN_ROLE). */
  async setComplianceRole(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    target: string,
    grant: boolean,
  ) {
    const to = address(target);
    if (!(await this.account(asset, account)).tokenAdmin)
      throw new Error(
        "Only a token admin of this fund can change compliance agents.",
      );
    const token = this.token(asset, await this.signer(wallet, account));
    return grant
      ? token.grantRole(COMPLIANCE_ROLE, to)
      : token.revokeRole(COMPLIANCE_ROLE, to);
  }
  /** Regulated assets (origin/main): AssetToken-compatible transferStatus pre-flight. */
  async preflight(asset: Asset, from: string, to: string, amount: bigint) {
    if (!asset.identityRegistry) return;
    const reason = Number(
      await this.token(asset).transferStatus(
        address(from),
        address(to),
        amount,
      ),
    );
    if (reason === 1 || reason === 2) {
      const registry = new Contract(
        asset.identityRegistry,
        abis.identity,
        this.provider,
      );
      const detail = Number(
        await registry.identityStatus(reason === 1 ? from : to),
      );
      const reasons = [
        "Valid",
        "Identity not registered",
        "Simulated KYC not approved",
        "Credential revoked",
        "KYC credential expired",
        "Credential attestor no longer trusted",
      ];
      throw new Error(
        `${reason === 1 ? "Sender" : "Recipient"}: ${reasons[detail] || "identity invalid"}.`,
      );
    }
    if (reason !== 0) throw new Error(transferReason(reason));
  }
  async manageSale(
    wallet: WalletProvider,
    account: string,
    asset: Asset,
    operation:
      | "withdrawProceeds"
      | "closeSale"
      | "recoverUnsoldTokens"
      | "sweepExcessETH",
  ) {
    if (asset.issuer.toLowerCase() !== account.toLowerCase())
      throw new Error("Only this asset’s issuer can manage its offering.");
    // D5 invariant 5: recovery moves tokens, so it reverts while paused.
    if (
      operation === "recoverUnsoldTokens" &&
      (await this.asset(asset.id)).paused
    )
      throw new Error(PAUSED);
    return this.sale(asset, await this.signer(wallet, account))[operation]();
  }
}
const request = new FetchRequest(targetNetwork.rpcUrl);
request.timeout = 12_000;
export const blockchain = new Blockchain(
  new JsonRpcProvider(request, undefined, {
    cacheTimeout: -1,
    pollingInterval: 1500,
  }),
);
