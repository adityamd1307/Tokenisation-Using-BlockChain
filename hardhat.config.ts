import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    profiles: {
      // AUD-014: AssetFactory embeds AssetToken and AssetSale; unoptimised it is at the EIP-170 limit.
      default: {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337,
    },
    // Persistent UI node follows wall time even when nobody submits transactions.
    // Keep hardhatMainnet deterministic for isolated tests and time-travel demos.
    localDemo: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337,
      mining: { auto: true, interval: 2000 },
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Phase 5 D12: Wallets A-D, from environment variables or `npx hardhat keystore set <NAME>`.
    // A deploys and is the platform admin; B is the issuer; C and D are investors. Never commit keys.
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("TESTNET_RPC_URL"),
      accounts: [
        configVariable("SEPOLIA_KEY_A"),
        configVariable("SEPOLIA_KEY_B"),
        configVariable("SEPOLIA_KEY_C"),
        configVariable("SEPOLIA_KEY_D"),
      ],
    },
  },
});
