import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY ?? "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    zerogTestnet: {
      url: process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: [DEPLOYER_PK],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
