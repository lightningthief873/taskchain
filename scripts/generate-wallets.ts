import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

function generateWallet(label: string) {
  const wallet = ethers.Wallet.createRandom();
  return { label, address: wallet.address, privateKey: wallet.privateKey };
}

async function main() {
  const envPath = path.join(__dirname, "../.env");
  const existingEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const wallets = [
    generateWallet("DEPLOYER"),
    generateWallet("ROUTER_AGENT"),
    generateWallet("TRANSLATOR_AGENT"),
    generateWallet("ANALYZER_AGENT"),
    generateWallet("WRITER_AGENT"),
  ];

  console.log("\n=== Generated Wallets ===\n");
  for (const w of wallets) {
    console.log(`${w.label}`);
    console.log(`  Address:     ${w.address}`);
    console.log(`  Private Key: ${w.privateKey}`);
    console.log();
  }

  // Append to .env without overwriting existing keys
  let envContent = existingEnv;
  const addKey = (key: string, value: string) => {
    const emptyPattern = new RegExp(`^${key}=\\s*$`, "m");
    if (emptyPattern.test(envContent)) {
      envContent = envContent.replace(emptyPattern, `${key}=${value}`);
    } else if (!envContent.includes(`${key}=`)) {
      envContent += `\n${key}=${value}`;
    }
  };

  for (const w of wallets) {
    addKey(`${w.label}_PRIVATE_KEY`, w.privateKey);
    addKey(`${w.label}_ADDRESS`, w.address);
  }

  fs.writeFileSync(envPath, envContent.trimStart());
  console.log("Keys appended to .env\n");

  console.log("=== Next Steps ===");
  console.log(`1. Fund DEPLOYER (${wallets[0].address}) with test AVAX:`);
  console.log("   https://faucet.avax.network/  (select Fuji, paste address)");
  console.log();
  console.log(`2. Fund ROUTER_AGENT (${wallets[1].address}) with test USDC on Fuji:`);
  console.log("   https://faucet.circle.com/  (select Avalanche Fuji, paste address)");
  console.log("   OR bridge test AVAX to USDC on https://testnet.traderjoexyz.com");
  console.log();
  console.log(`3. TRANSLATOR_AGENT (${wallets[2].address}) — needs small AVAX for gas (recordCompletion)`);
  console.log();
  console.log(`4. ANALYZER_AGENT (${wallets[3].address}) — needs small AVAX for gas (recordCompletion)`);
  console.log(`   Fund at: https://faucet.avax.network/ (Fuji, paste address)`);
  console.log();
  console.log(`5. WRITER_AGENT (${wallets[4].address}) — needs small AVAX for gas (recordCompletion)`);
  console.log(`   Fund at: https://faucet.avax.network/ (Fuji, paste address)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
