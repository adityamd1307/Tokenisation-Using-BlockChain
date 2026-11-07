import { parseSingaporeDateTime } from "../utils/time";
import {
  Contract,
  ZeroHash,
  isHexString,
  type TransactionResponse,
} from "ethers";
import { abis } from "../config/contracts";
import { blockchain, type Blockchain } from "./blockchain";
import type { Asset, WalletProvider } from "../types";
import { address } from "../utils/validation";
import { countries } from "../utils/compliance";
export interface CredentialInput {
  identityId: string;
  country: string;
  kycApproved: boolean;
  accredited: boolean;
  validUntil: string;
}
export class Compliance {
  constructor(readonly api: Blockchain) {}
  registry(asset: Asset) {
    if (!asset.identityRegistry)
      throw new Error("This asset uses the legacy whitelist.");
    return new Contract(
      asset.identityRegistry,
      abis.identity,
      this.api.provider,
    );
  }
  policy(asset: Asset) {
    return new Contract(
      asset.compliancePolicy!,
      abis.compliance,
      this.api.provider,
    );
  }
  async state(asset: Asset, who?: string) {
    const registry = this.registry(asset),
      policy = this.policy(asset);
    const [maximum, accredited, allowed, administrator, attestorRole] =
      await Promise.all([
        policy.maxWalletHolding(),
        policy.accreditationRequired(),
        Promise.all(countries.map((c) => policy.countryAllowed(c.code))),
        policy.administrator(),
        registry.TRUSTED_ATTESTOR_ROLE(),
      ]);
    const roles = who
      ? await Promise.all([
          registry.hasRole(ZeroHash, who),
          registry.hasRole(attestorRole, who),
        ])
      : [false, false];
    return {
      maximum: maximum as bigint,
      accredited: accredited as boolean,
      allowed: allowed as boolean[],
      identityAdmin: !!roles[0],
      attestor: !!roles[1],
      policyAdmin: !!who && administrator.toLowerCase() === who.toLowerCase(),
    };
  }
  async identity(asset: Asset, who: string) {
    const registry = this.registry(asset),
      wallet = address(who);
    const [record, status, role, block, operational] = await Promise.all([
      registry.identity(wallet),
      registry.identityStatus(wallet),
      registry.TRUSTED_ATTESTOR_ROLE(),
      this.api.provider.getBlock("latest"),
      this.api.token(asset).operationalClass(wallet),
    ]);
    const trusted = await registry.hasRole(role, record.attestedBy);
    return {
      identityId: String(record.identityId),
      country: Number(record.country),
      kycApproved: Boolean(record.kycApproved),
      accredited: Boolean(record.accredited),
      validUntil: BigInt(record.validUntil),
      attestedBy: String(record.attestedBy),
      revoked: Boolean(record.revoked),
      status: Number(status),
      trusted: Boolean(trusted),
      chainTime: BigInt(block!.timestamp),
      operational: Number(operational),
    };
  }
  async check(asset: Asset, from: string, to: string, value: string) {
    if (!/^\d+$/.test(value))
      throw new Error("Enter a whole non-negative token quantity.");
    const amount = BigInt(value);
    if (amount >= 2n ** 256n) throw new Error("Token quantity is too large.");
    const sender = address(from),
      recipient = address(to),
      token = this.api.token(asset);
    const [reason, identity, recipientPolicy, policyTransfer] =
      await Promise.all([
        token.transferStatus(sender, recipient, amount),
        this.identity(asset, recipient),
        this.policy(asset).recipientStatus(recipient),
        this.policy(asset).transferStatus(sender, recipient, amount),
      ]);
    const senderIdentity = await this.identity(asset, sender);
    return {
      reason: Number(reason),
      identity,
      senderIdentity,
      recipientPolicy: Number(recipientPolicy),
      policyTransfer: Number(policyTransfer),
    };
  }
  async attest(
    wallet: WalletProvider,
    who: string,
    asset: Asset,
    investor: string,
    data: CredentialInput,
    renew: boolean,
  ): Promise<TransactionResponse> {
    if (!isHexString(data.identityId, 32) || data.identityId === ZeroHash)
      throw new Error("Use a nonzero 32-byte synthetic identity ID.");
    const country = Number(data.country);
    if (!countries.some((c) => c.code === country))
      throw new Error("Unsupported demo country.");
    const milliseconds = parseSingaporeDateTime(data.validUntil),
      block = await this.api.provider.getBlock("latest");
    if (
      !Number.isFinite(milliseconds) ||
      milliseconds / 1000 <= block!.timestamp
    )
      throw new Error(
        "Credential expiry must be later than the current chain time.",
      );
    const target = address(investor);
    if (target.toLowerCase() === who.toLowerCase())
      throw new Error("Trusted attestors cannot approve their own wallet.");
    const registry = this.registry(asset).connect(
      await this.api.signer(wallet, who),
    ) as Contract;
    return registry[renew ? "updateIdentity" : "registerIdentity"](target, [
      data.identityId,
      country,
      data.kycApproved,
      data.accredited,
      BigInt(Math.floor(milliseconds / 1000)),
    ]);
  }
  async revoke(
    wallet: WalletProvider,
    who: string,
    asset: Asset,
    investor: string,
  ): Promise<TransactionResponse> {
    return (
      this.registry(asset).connect(
        await this.api.signer(wallet, who),
      ) as Contract
    ).revokeIdentity(address(investor));
  }
  async trust(
    wallet: WalletProvider,
    who: string,
    asset: Asset,
    attestor: string,
    approved: boolean,
  ): Promise<TransactionResponse> {
    const r = this.registry(asset),
      role = await r.TRUSTED_ATTESTOR_ROLE();
    return (r.connect(await this.api.signer(wallet, who)) as Contract)[
      approved ? "grantRole" : "revokeRole"
    ](role, address(attestor));
  }
  async updatePolicy(
    wallet: WalletProvider,
    who: string,
    asset: Asset,
    operation:
      "setCountryAllowed" | "setMaxWalletHolding" | "setAccreditationRequired",
    value: string,
    enabled: boolean,
  ): Promise<TransactionResponse> {
    const c = this.policy(asset).connect(
      await this.api.signer(wallet, who),
    ) as Contract;
    if (operation === "setAccreditationRequired")
      return c.setAccreditationRequired(enabled);
    if (!/^\d+$/.test(value))
      throw new Error("Enter a whole non-negative number.");
    if (operation === "setCountryAllowed")
      return c.setCountryAllowed(BigInt(value), enabled);
    return c.setMaxWalletHolding(BigInt(value));
  }
}
export const compliance = new Compliance(blockchain);
