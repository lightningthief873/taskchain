import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import Anthropic from "@anthropic-ai/sdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  FUJI_RPC_URL,
  FUJI_NETWORK,
  USDC_FUJI,
  USDC_DECIMALS,
  WRITER_PORT,
  WRITER_PRICE_RAW,
  FACILITATOR_URL,
  AGENT_REGISTRY_ADDRESS,
} from "../../shared/config";

dotenv.config();

const WRITER_ADDRESS = process.env.WRITER_AGENT_ADDRESS as `0x${string}`;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!WRITER_ADDRESS) throw new Error("WRITER_AGENT_ADDRESS not set in .env");
if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set in .env");

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

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
            amount: WRITER_PRICE_RAW,
            asset: USDC_FUJI,
            extra: { name: "USD Coin", version: "2", decimals: USDC_DECIMALS },
          },
          network: FUJI_NETWORK,
          payTo: WRITER_ADDRESS,
          maxTimeoutSeconds: 60,
        },
        description: "Write a formatted summary paragraph using Claude AI — 0.01 USDC",
      },
    },
    resourceServer,
  ),
);

app.post("/execute", async (req, res) => {
  const body = req.body as {
    analysis?: Record<string, unknown>;
    instruction?: string;
    input?: { stats?: Record<string, unknown> };
  };
  const stats = body.analysis ?? body.input?.stats;

  if (!stats || typeof stats !== "object") {
    res.status(400).json({ error: "Missing 'analysis' object in request body" });
    return;
  }

  const taskId = ethers.hexlify(ethers.randomBytes(32));

  try {
    let summary: string;

    if (process.env.MOCK_WRITING === "true") {
      const s = stats as Record<string, unknown>;
      summary = `[MOCK] The dataset contains ${s.count} values ranging from ${s.min} to ${s.max}. The mean value is ${s.mean} and the median is ${s.median}, with a total sum of ${s.sum}. This balanced distribution suggests a uniform spread across the range.`;
    } else {
      const statsStr = JSON.stringify(stats, null, 2);
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Write a concise one-paragraph summary of the following data statistics. Be informative and professional:\n\n${statsStr}`,
          },
        ],
      });
      summary = message.content[0].type === "text" ? message.content[0].text : "";
    }

    if (AGENT_REGISTRY_ADDRESS && process.env.WRITER_AGENT_PRIVATE_KEY) {
      recordCompletionOnChain(taskId, true).catch((e) =>
        console.error("on-chain record failed:", e.message),
      );
    }

    res.json({ taskId, summary, model: "claude-sonnet-4-20250514" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Writer error:", message);

    if (AGENT_REGISTRY_ADDRESS && process.env.WRITER_AGENT_PRIVATE_KEY) {
      recordCompletionOnChain(taskId, false).catch(() => {});
    }

    res.status(500).json({ error: "Writing failed", details: message });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    agent: "writer",
    address: WRITER_ADDRESS,
    network: FUJI_NETWORK,
    price: `${parseInt(WRITER_PRICE_RAW) / 10 ** USDC_DECIMALS} USDC`,
  });
});

async function recordCompletionOnChain(taskId: string, success: boolean) {
  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const wallet = new ethers.Wallet(process.env.WRITER_AGENT_PRIVATE_KEY!, provider);
  const abi = ["function recordCompletion(address agent, bytes32 taskId, bool success) external"];
  const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS!, abi, wallet);
  const tx = await registry.recordCompletion(WRITER_ADDRESS, taskId, success);
  console.log(`Reputation recorded on-chain: ${tx.hash} (success=${success})`);
}

app.listen(WRITER_PORT, () => {
  console.log(`\nWriter agent running on port ${WRITER_PORT}`);
  console.log(`  Address:     ${WRITER_ADDRESS}`);
  console.log(`  Network:     ${FUJI_NETWORK}`);
  console.log(`  Price:       ${parseInt(WRITER_PRICE_RAW) / 10 ** USDC_DECIMALS} USDC`);
  console.log(`  Facilitator: ${FACILITATOR_URL}`);
  console.log(`  POST http://localhost:${WRITER_PORT}/execute\n`);
});
