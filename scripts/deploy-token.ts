/**
 * Deploy TaskToken and TaskStaking to Fuji.
 *
 * Prerequisites:
 *   - DEPLOYER_PRIVATE_KEY in .env (funded with test AVAX)
 *   - Run: npx hardhat compile
 *
 * Usage:
 *   npx ts-node scripts/deploy-token.ts
 *
 * After deploy, add to .env:
 *   TASK_TOKEN_ADDRESS=<address>
 *   TASK_STAKING_ADDRESS=<address>
 *   NEXT_PUBLIC_TASK_TOKEN_ADDRESS=<address>
 *   NEXT_PUBLIC_TASK_STAKING_ADDRESS=<address>
 */
import "dotenv/config";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { FUJI_RPC_URL } from "../shared/config";

async function loadArtifact(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`Artifact missing for ${name} — run: npx hardhat compile`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.parse(fs.readFileSync(p, "utf8")) as { abi: any[]; bytecode: string };
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const deployer = new ethers.Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  console.log(`Chain: ${network.chainId} (expected 43113)`);
  if (network.chainId !== 43113n) throw new Error("Not Fuji — check FUJI_RPC_URL");

  const balance = await provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);
  if (balance === 0n) throw new Error("Deployer has 0 AVAX — fund at https://faucet.avax.network/");

  // ── Deploy TaskToken ────────────────────────────────────────────────────────
  console.log("\nDeploying TaskToken...");
  const tokenArtifact = await loadArtifact("TaskToken");
  const tokenFactory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, deployer);
  const token = await tokenFactory.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`✅ TaskToken deployed: ${tokenAddress}`);
  console.log(`   https://testnet.snowtrace.io/address/${tokenAddress}`);

  // ── Deploy TaskStaking ──────────────────────────────────────────────────────
  console.log("\nDeploying TaskStaking...");
  const stakingArtifact = await loadArtifact("TaskStaking");
  const stakingFactory = new ethers.ContractFactory(stakingArtifact.abi, stakingArtifact.bytecode, deployer);
  const staking = await stakingFactory.deploy(tokenAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log(`✅ TaskStaking deployed: ${stakingAddress}`);
  console.log(`   https://testnet.snowtrace.io/address/${stakingAddress}`);

  console.log("\nAdd to .env:");
  console.log(`TASK_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`TASK_STAKING_ADDRESS=${stakingAddress}`);
  console.log(`NEXT_PUBLIC_TASK_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_TASK_STAKING_ADDRESS=${stakingAddress}`);
}

main().catch((e) => {
  console.error("Deploy failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
