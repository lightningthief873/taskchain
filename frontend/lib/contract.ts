import { ethers } from "ethers";
import { REGISTRY_ADDRESS, FUJI_RPC } from "./config";

export const REGISTRY_ABI = [
  "function getReputation(address agent) external view returns (uint256 successes, uint256 failures, uint256 score)",
  "function isRegistered(address agent) external view returns (bool)",
  "function getMetadataURI(address agent) external view returns (string)",
  "event TaskCompleted(address indexed agent, bytes32 indexed taskId, bool success)",
  "event AgentRegistered(address indexed agent, string metadataURI)",
];

export function getProvider() {
  return new ethers.JsonRpcProvider(FUJI_RPC);
}

export function getRegistry() {
  return new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, getProvider());
}

export interface Reputation {
  successes: bigint;
  failures: bigint;
  score: bigint;
}

export async function fetchReputation(address: string): Promise<Reputation> {
  const contract = getRegistry();
  const [successes, failures, score] = await contract.getReputation(address);
  return { successes, failures, score };
}

export interface TaskCompletedEvent {
  agent: string;
  taskId: string;
  success: boolean;
  blockNumber: number;
  txHash: string;
}

export async function fetchRecentEvents(fromBlock = -200): Promise<TaskCompletedEvent[]> {
  const contract = getRegistry();
  const filter = contract.filters.TaskCompleted();
  const logs = await contract.queryFilter(filter, fromBlock);
  return logs
    .slice()
    .reverse()
    .map((log) => {
      const e = log as ethers.EventLog;
      return {
        agent: e.args[0] as string,
        taskId: e.args[1] as string,
        success: e.args[2] as boolean,
        blockNumber: e.blockNumber,
        txHash: e.transactionHash,
      };
    });
}
