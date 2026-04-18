import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { FUJI_RPC_URL, AGENT_REGISTRY_ADDRESS } from "../shared/config";

dotenv.config();

const REGISTRY_ABI = [
  "function registerAgent(address agent, string calldata metadataURI) external",
  "function isRegistered(address agent) external view returns (bool)",
  "function getReputation(address agent) external view returns (uint256 successes, uint256 failures, uint256 score)",
  "event AgentRegistered(address indexed agent, string metadataURI)",
];

const AGENTS = [
  {
    name: "translator",
    addressEnvKey: "TRANSLATOR_AGENT_ADDRESS",
    metadataURI: JSON.stringify({
      name: "Translator Agent",
      description: "Translates text to Spanish via Claude AI",
      endpoint: "http://localhost:3001",
      price: "0.01 USDC",
      network: "eip155:43113",
    }),
  },
];

async function main() {
  if (!AGENT_REGISTRY_ADDRESS) throw new Error("AGENT_REGISTRY_ADDRESS not set — run deploy.ts first");
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const deployer = new ethers.Wallet(deployerKey, provider);
  const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, REGISTRY_ABI, deployer);

  console.log(`Registry: ${AGENT_REGISTRY_ADDRESS}`);
  console.log(`Registering from: ${deployer.address}\n`);

  for (const agent of AGENTS) {
    const address = process.env[agent.addressEnvKey] as string;
    if (!address) {
      console.warn(`Skipping ${agent.name}: ${agent.addressEnvKey} not set`);
      continue;
    }

    const already = await registry.isRegistered(address);
    if (already) {
      console.log(`${agent.name} (${address}) already registered — skipping`);
      const rep = await registry.getReputation(address);
      console.log(`  Reputation: successes=${rep.successes}, failures=${rep.failures}, score=${rep.score}`);
      continue;
    }

    console.log(`Registering ${agent.name} at ${address}...`);
    const tx = await registry.registerAgent(address, agent.metadataURI);
    const receipt = await tx.wait();
    console.log(`  Tx: ${receipt.hash}`);
    console.log(`  Explorer: https://testnet.snowtrace.io/tx/${receipt.hash}`);
    console.log(`  ✓ ${agent.name} registered`);
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
