import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  FUJI_RPC_URL,
  FUJI_NETWORK,
  USDC_FUJI,
  USDC_DECIMALS,
  ANALYZER_PORT,
  ANALYZER_PRICE_RAW,
  FACILITATOR_URL,
  AGENT_REGISTRY_ADDRESS,
} from "../../shared/config";

dotenv.config();

const ANALYZER_ADDRESS = process.env.ANALYZER_AGENT_ADDRESS as `0x${string}`;
if (!ANALYZER_ADDRESS) throw new Error("ANALYZER_AGENT_ADDRESS not set in .env");

const evmScheme = new ExactEvmScheme();
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(FUJI_NETWORK, evmScheme);

const app = express();
app.use(express.json());

app.use(
  paymentMiddleware(
    {
      "POST /execute": {
        accepts: {
          scheme: "exact",
          price: {
            amount: ANALYZER_PRICE_RAW,
            asset: USDC_FUJI,
            extra: { name: "USD Coin", version: "2", decimals: USDC_DECIMALS },
          },
          network: FUJI_NETWORK,
          payTo: ANALYZER_ADDRESS,
          maxTimeoutSeconds: 60,
        },
        description: "Analyze numeric data and compute statistics — 0.01 USDC",
      },
    },
    resourceServer,
  ),
);

app.post("/execute", async (req, res) => {
  const body = req.body as { data?: number[]; instruction?: string; input?: { data?: number[] } };
  const rawData = body.data ?? body.input?.data;

  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    res.status(400).json({ error: "Missing or empty 'data' array in request body" });
    return;
  }

  const nums = rawData.map(Number).filter((n) => !isNaN(n));
  const taskId = ethers.hexlify(ethers.randomBytes(32));

  let stats: object;
  if (process.env.MOCK_ANALYSIS === "true") {
    stats = {
      count: nums.length,
      min: 1,
      max: 5,
      sum: 15,
      mean: 3,
      median: 3,
      data: rawData,
    };
  } else {
    const sorted = [...nums].sort((a, b) => a - b);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    stats = { count: nums.length, min: sorted[0], max: sorted[sorted.length - 1], sum, mean, median, data: rawData };
  }

  if (AGENT_REGISTRY_ADDRESS && process.env.ANALYZER_AGENT_PRIVATE_KEY) {
    recordCompletionOnChain(taskId, true).catch((e) =>
      console.error("on-chain record failed:", e.message),
    );
  }

  res.json({ taskId, stats, instruction: body.instruction });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    agent: "analyzer",
    address: ANALYZER_ADDRESS,
    network: FUJI_NETWORK,
    price: `${parseInt(ANALYZER_PRICE_RAW) / 10 ** USDC_DECIMALS} USDC`,
  });
});

async function recordCompletionOnChain(taskId: string, success: boolean) {
  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ANALYZER_AGENT_PRIVATE_KEY!, provider);
  const abi = ["function recordCompletion(address agent, bytes32 taskId, bool success) external"];
  const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS!, abi, wallet);
  const tx = await registry.recordCompletion(ANALYZER_ADDRESS, taskId, success);
  console.log(`Reputation recorded on-chain: ${tx.hash} (success=${success})`);
}

app.listen(ANALYZER_PORT, () => {
  console.log(`\nAnalyzer agent running on port ${ANALYZER_PORT}`);
  console.log(`  Address:     ${ANALYZER_ADDRESS}`);
  console.log(`  Network:     ${FUJI_NETWORK}`);
  console.log(`  Price:       ${parseInt(ANALYZER_PRICE_RAW) / 10 ** USDC_DECIMALS} USDC`);
  console.log(`  Facilitator: ${FACILITATOR_URL}`);
  console.log(`  POST http://localhost:${ANALYZER_PORT}/execute\n`);
});
