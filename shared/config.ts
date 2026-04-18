import * as dotenv from "dotenv";
dotenv.config();

export const FUJI_CHAIN_ID = 43113;
export const FUJI_RPC_URL =
  process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

export const USDC_FUJI = (
  process.env.USDC_CONTRACT_ADDRESS || "0x5425890298aed601595a70AB815c96711a31Bc65"
) as `0x${string}`;

export const USDC_DECIMALS = 6;

// 0.01 USDC in raw units (6 decimals)
export const TRANSLATION_PRICE_RAW = "10000";

// x402 network identifier for Fuji
export const FUJI_NETWORK = "eip155:43113";

export const FACILITATOR_URL =
  process.env.PAYMENT_FACILITATOR_URL || "https://facilitator.x402.org";

export const AGENT_REGISTRY_ADDRESS =
  process.env.AGENT_REGISTRY_ADDRESS as `0x${string}` | undefined;

export const TRANSLATOR_PORT = parseInt(process.env.TRANSLATOR_PORT || "3001", 10);
