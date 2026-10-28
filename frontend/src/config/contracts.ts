import addresses from "./addresses.json";
import factoryAbi from "./abi/AssetFactory.json";
import tokenAbi from "./abi/AssetToken.json";
import saleAbi from "./abi/AssetSale.json";

export interface Deployment {
  chainId: number;
  AssetFactory: string;
  deployBlock: number;
  deployBlockHash?: string;
  runtimeCodeHash?: string;
}
export const deployment: Deployment = addresses;
export const abis = { factory: factoryAbi, token: tokenAbi, sale: saleAbi };
