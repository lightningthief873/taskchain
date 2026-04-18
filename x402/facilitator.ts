/**
 * Local x402 facilitator for Avalanche Fuji testnet.
 * Exposes /verify, /settle, /supported endpoints used by x402-express resource servers.
 * Uses the deployer wallet (funded with AVAX) to pay gas for USDC transferWithAuthorization.
 */
import express from "express";
import { createWalletClient, createPublicClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import * as dotenv from "dotenv";

dotenv.config();

const FACILITATOR_PORT = parseInt(process.env.FACILITATOR_PORT || "4021", 10);
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const FUJI_RPC = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

if (!DEPLOYER_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");

const account = privateKeyToAccount(DEPLOYER_KEY);

// Create a viem wallet client connected to Fuji — used for gas-paying transactions
const walletClient = createWalletClient({
  account,
  chain: avalancheFuji,
  transport: http(FUJI_RPC),
}).extend(publicActions);

// toFacilitatorEvmSigner wraps the wallet client and needs `client.address` to be set
// Viem stores it on client.account.address, so we spread it up to the top level
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const facilitatorSigner = toFacilitatorEvmSigner({ ...walletClient, address: account.address } as any);

// Build the x402 facilitator with EVM EIP-3009 support for all eip155 chains
const facilitator = new x402Facilitator().register(
  ["eip155:43113"],
  new ExactEvmScheme(facilitatorSigner),
);

const app = express();
app.use(express.json());

// Return supported payment kinds, extensions, and facilitator signers
app.get("/supported", (_req, res) => {
  res.json(facilitator.getSupported());
});

// Also support POST /supported (some x402 versions use POST)
app.post("/supported", (_req, res) => {
  res.json(facilitator.getSupported());
});

// Verify a payment authorization without executing on-chain
app.post("/verify", async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  if (!paymentPayload || !paymentRequirements) {
    res.status(400).json({ isValid: false, invalidReason: "missing_fields" });
    return;
  }
  try {
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    if (result.isValid) {
      res.json(result);
    } else {
      res.status(402).json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("verify error:", message);
    res.status(500).json({ isValid: false, invalidReason: "facilitator_error", invalidMessage: message });
  }
});

// Verify and execute the on-chain USDC transfer
app.post("/settle", async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  if (!paymentPayload || !paymentRequirements) {
    res.status(400).json({ success: false, errorReason: "missing_fields" });
    return;
  }
  try {
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    if (result.success) {
      console.log(`Payment settled: ${result.transaction} (${result.network})`);
      res.json(result);
    } else {
      res.status(402).json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("settle error:", message);
    res.status(500).json({ success: false, errorReason: "facilitator_error", errorMessage: message });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    facilitator: account.address,
    networks: ["eip155:43113"],
  });
});

app.listen(FACILITATOR_PORT, () => {
  console.log(`\nLocal x402 facilitator running on port ${FACILITATOR_PORT}`);
  console.log(`  Signer:   ${account.address}`);
  console.log(`  Networks: eip155:43113 (Avalanche Fuji)`);
  console.log(`  URL:      http://localhost:${FACILITATOR_PORT}\n`);
});
