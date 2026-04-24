/**
 * Canonical contract addresses — always read from environment, never hardcoded.
 * Import this everywhere instead of using process.env.XYZ_ADDRESS directly.
 */

export const CONTRACTS = {
  /** Circle testnet USDC on Fuji */
  USDC: process.env.USDC_CONTRACT_ADDRESS ?? "0x5425890298aed601595a70AB815c96711a31Bc65",
  /** ERC-8004 AgentRegistry */
  AGENT_REGISTRY: process.env.AGENT_REGISTRY_ADDRESS ?? "0xdDe74f96020161783d2663999f531a316904105e",
  /** SatisfactionEscrow (USDC + TASK payments) */
  SATISFACTION_ESCROW: process.env.SATISFACTION_ESCROW_ADDRESS ?? "",
  /** TaskChain ERC-20 governance token */
  TASK_TOKEN: process.env.TASK_TOKEN_ADDRESS ?? "",
  /** TaskStaking — stake TASK for Verified status + rewards */
  TASK_STAKING: process.env.TASK_STAKING_ADDRESS ?? "",
} as const;

/** Chain IDs */
export const CHAIN_IDS = {
  FUJI: 43113,
  MAINNET: 43114,
} as const;
