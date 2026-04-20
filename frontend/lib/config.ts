export const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_REGISTRY ?? "0xdDe74f96020161783d2663999f531a316904105e";

export const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC ?? "https://api.avax-test.network/ext/bc/C/rpc";

export const ROUTER_URL =
  process.env.NEXT_PUBLIC_ROUTER_URL ?? "http://localhost:3000";

export const SNOWTRACE = "https://testnet.snowtrace.io";

export const AGENTS = {
  analyzer: {
    address: "0xADa0D502dD3d51B3A0f1E26d8C6826Bb7D456BeF",
    name: "Analyzer",
    description: "Computes statistics on numeric data",
    price: "0.01 USDC",
  },
  writer: {
    address: "0xEeA0d97AEe6d8eCFCEb69De9479e15C3ee843840",
    name: "Writer",
    description: "Writes formatted prose summaries",
    price: "0.01 USDC",
  },
  translator: {
    address: "0x106927178B6a28efFF6fad138443E3d898fe2Ac8",
    name: "Translator",
    description: "Translates text to Spanish",
    price: "0.01 USDC",
  },
} as const;

export type AgentKey = keyof typeof AGENTS;
