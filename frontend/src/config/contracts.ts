import addresses from "./addresses.json";
import factoryAbi from "./abi/AssetFactory.json";
import tokenAbi from "./abi/AssetToken.json";
import saleAbi from "./abi/AssetSale.json";
import usdAbi from "./abi/MockUSD.json";
import subscriptionFactoryAbi from "./abi/SubscriptionFactory.json";
import offeringAbi from "./abi/SubscriptionOffering.json";

export interface Deployment {
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
  factory: factoryAbi,
  token: tokenAbi,
  sale: saleAbi,
  usd: usdAbi,
  subscriptionFactory: subscriptionFactoryAbi,
  offering: offeringAbi,
};
