import identityAbi from "./abi/IdentityRegistryLite.json";
import complianceAbi from "./abi/ComplianceLite.json";
import regulatedTokenAbi from "./abi/RegulatedAssetToken.json";
import regulatedFactoryAbi from "./abi/RegulatedAssetFactory.json";
import addresses from "./addresses.json";
import factoryAbi from "./abi/AssetFactory.json";
import tokenAbi from "./abi/AssetToken.json";
import saleAbi from "./abi/AssetSale.json";
import usdAbi from "./abi/MockUSD.json";
import subscriptionFactoryAbi from "./abi/SubscriptionFactory.json";
import offeringAbi from "./abi/SubscriptionOffering.json";

export interface Deployment {
  regulatedFactory?: boolean;
  chainId: number;
  AssetFactory: string;
  deployBlock: number;
  deployBlockHash?: string;
  runtimeCodeHash?: string;
  SubscriptionFactory?: string;
  MockUSD?: string;
  subscriptionFactoryCodeHash?: string;
  mockUSDCodeHash?: string;
  subscriptionDeployBlock?: number;
}
export const deployment: Deployment = addresses;
export const abis = {
  identity: identityAbi,
  compliance: complianceAbi,
  regulatedToken: regulatedTokenAbi,
  regulatedFactory: regulatedFactoryAbi,
  factory: factoryAbi,
  token: tokenAbi,
  sale: saleAbi,
  usd: usdAbi,
  subscriptionFactory: subscriptionFactoryAbi,
  offering: offeringAbi,
};
