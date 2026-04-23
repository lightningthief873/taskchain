/**
 * Airdrop 1000 TASK to 10 demo wallets for hackathon presentation.
 *
 * Prerequisites:
 *   - TASK_TOKEN_ADDRESS in .env
 *   - DEPLOYER_PRIVATE_KEY in .env (holds all TASK supply)
 *
 * Usage:
 *   npx ts-node scripts/distribute-tokens.ts
 *
 * Outputs wallet addresses + private keys — testnet-only, do NOT reuse on mainnet.
 */
import "dotenv/config";
import { ethers } from "ethers";
import { FUJI_RPC_URL } from "../shared/config";

const TASK_TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const AIRDROP_AMOUNT = ethers.parseUnits("1000", 18); // 1000 TASK per wallet
const WALLET_COUNT = 10;

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const tokenAddress = process.env.TASK_TOKEN_ADDRESS;

  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  if (!tokenAddress) throw new Error("TASK_TOKEN_ADDRESS not set");

  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const deployer = new ethers.Wallet(privateKey, provider);
  const token = new ethers.Contract(tokenAddress, TASK_TOKEN_ABI, deployer);

  const deployerBalance = await token.balanceOf(deployer.address) as bigint;
  console.log(`Deployer TASK balance: ${ethers.formatUnits(deployerBalance, 18)} TASK`);
  if (deployerBalance < AIRDROP_AMOUNT * BigInt(WALLET_COUNT)) {
    throw new Error("Insufficient TASK balance for airdrop");
  }

  console.log(`\nGenerating ${WALLET_COUNT} demo wallets and sending 1000 TASK each...\n`);
  const wallets: { address: string; privateKey: string }[] = [];

  for (let i = 0; i < WALLET_COUNT; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push({ address: wallet.address, privateKey: wallet.privateKey });

    const tx = await (token.transfer(wallet.address, AIRDROP_AMOUNT) as Promise<ethers.TransactionResponse>);
    await tx.wait();
    console.log(`[${i + 1}] ${wallet.address} — 1000 TASK sent (tx: ${tx.hash.slice(0, 18)}…)`);
  }

  console.log("\n=== Demo Wallet Private Keys (TESTNET ONLY — NEVER USE ON MAINNET) ===");
  wallets.forEach((w, i) => {
    console.log(`Wallet ${i + 1}: ${w.address}`);
    console.log(`  PK: ${w.privateKey}`);
  });

  console.log(`\n✅ Airdrop complete. ${WALLET_COUNT} wallets each have 1000 TASK.`);
  console.log("To demo staking: import a wallet PK into MetaMask, visit /token, stake 1000 TASK.");
}

main().catch((e) => {
  console.error("Airdrop failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
