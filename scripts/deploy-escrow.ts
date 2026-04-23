/**
 * Deploy SatisfactionEscrow to Fuji.
 *
 * Prerequisites:
 *   - DEPLOYER_PRIVATE_KEY in .env (funded with test AVAX)
 *   - Run: npx hardhat compile
 *
 * Usage:
 *   npx ts-node scripts/deploy-escrow.ts
 *
 * After deploy, add to .env:
 *   SATISFACTION_ESCROW_ADDRESS=<deployed address>
 *   TREASURY_ADDRESS=<deployer or separate wallet>
 */
import "dotenv/config";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { FUJI_RPC_URL, USDC_FUJI } from "../shared/config";

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const treasuryAddress =
    process.env.TREASURY_ADDRESS ?? new ethers.Wallet(privateKey).address;

  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const deployer = new ethers.Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  console.log(`Chain: ${network.chainId} (expected 43113)`);
  if (network.chainId !== 43113n) throw new Error("Not Fuji — check FUJI_RPC_URL");

  const balance = await provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);
  if (balance === 0n) throw new Error("Deployer has 0 AVAX — fund at https://faucet.avax.network/");

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/SatisfactionEscrow.sol/SatisfactionEscrow.json",
  );
  if (!fs.existsSync(artifactPath))
    throw new Error("Artifact missing — run: npx hardhat compile");

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abi: any[];
    bytecode: string;
  };

  console.log(`\nDeploying SatisfactionEscrow...`);
  console.log(`  USDC:     ${USDC_FUJI}`);
  console.log(`  Treasury: ${treasuryAddress}`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const contract = await factory.deploy(USDC_FUJI, treasuryAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✅ SatisfactionEscrow deployed: ${address}`);
  console.log(`   Explorer: https://testnet.snowtrace.io/address/${address}`);
  console.log(`\nAdd to .env:`);
  console.log(`SATISFACTION_ESCROW_ADDRESS=${address}`);
  console.log(`TREASURY_ADDRESS=${treasuryAddress}`);
}

main().catch((e) => {
  console.error("Deploy failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
