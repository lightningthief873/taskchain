import { ethers } from "ethers";
import type { AgentType, AgentInfo } from "../../shared/types";
import { FUJI_RPC_URL, AGENT_REGISTRY_ADDRESS, TRANSLATOR_PORT, ANALYZER_PORT, WRITER_PORT } from "../../shared/config";

const REGISTRY_ABI = [
  "function getReputation(address agent) external view returns (uint256 successes, uint256 failures, uint256 score)",
  "function isRegistered(address agent) external view returns (bool)",
];

// Static registry: one agent per type (Phase 2 uses single-agent-per-type model)
function getAgentRegistry(): Record<AgentType, { address: string; port: number }> {
  return {
    translator: {
      address: process.env.TRANSLATOR_AGENT_ADDRESS || "",
      port: TRANSLATOR_PORT,
    },
    analyzer: {
      address: process.env.ANALYZER_AGENT_ADDRESS || "",
      port: ANALYZER_PORT,
    },
    writer: {
      address: process.env.WRITER_AGENT_ADDRESS || "",
      port: WRITER_PORT,
    },
  };
}

export async function selectAgent(agentType: AgentType): Promise<AgentInfo> {
  const registry = getAgentRegistry();
  const entry = registry[agentType];
  if (!entry || !entry.address) {
    throw new Error(`No address configured for agent type: ${agentType}`);
  }

  const url = `http://localhost:${entry.port}`;
  let reputation: AgentInfo["reputation"] = { successes: 0n, failures: 0n, score: 0n };

  if (AGENT_REGISTRY_ADDRESS) {
    try {
      const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
      const contract = new ethers.Contract(AGENT_REGISTRY_ADDRESS, REGISTRY_ABI, provider);
      const rep = await contract.getReputation(entry.address);
      reputation = { successes: rep[0], failures: rep[1], score: rep[2] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[selector] Could not fetch reputation for ${agentType}: ${msg}`);
    }
  }

  console.log(
    `[selector] ${agentType} → ${entry.address} (score=${reputation.score}, successes=${reputation.successes})`,
  );

  return { agentType, address: entry.address, url, reputation };
}
