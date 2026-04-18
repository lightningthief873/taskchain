import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { FUJI_RPC_URL } from "../shared/config";

dotenv.config();

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  console.log(`Connected to chain: ${network.chainId} (expected 43113 for Fuji)`);
  if (network.chainId !== 43113n) throw new Error("Not connected to Fuji — check FUJI_RPC_URL");

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);
  if (balance === 0n) throw new Error("Deployer wallet has 0 AVAX — fund it first at https://faucet.avax.network/");

  // Load compiled artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Artifact not found — run: npx hardhat compile");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("\nDeploying AgentRegistry...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nAgentRegistry deployed to: ${address}`);
  console.log(`Explorer: https://testnet.snowtrace.io/address/${address}`);

  // Write address to .env
  const envPath = path.join(__dirname, "../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (envContent.includes("AGENT_REGISTRY_ADDRESS=")) {
    envContent = envContent.replace(/AGENT_REGISTRY_ADDRESS=.*/g, `AGENT_REGISTRY_ADDRESS=${address}`);
  } else {
    envContent += `\nAGENT_REGISTRY_ADDRESS=${address}`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log(`\nAGENT_REGISTRY_ADDRESS saved to .env`);

  const deployTx = contract.deploymentTransaction();
  if (deployTx) {
    console.log(`Tx hash: ${deployTx.hash}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
