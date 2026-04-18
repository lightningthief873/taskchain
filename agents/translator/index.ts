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
  TRANSLATION_PRICE_RAW,
  FACILITATOR_URL,
  AGENT_REGISTRY_ADDRESS,
  TRANSLATOR_PORT,
} from "../../shared/config";

dotenv.config();

const TRANSLATOR_ADDRESS = process.env.TRANSLATOR_AGENT_ADDRESS as `0x${string}`;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!TRANSLATOR_ADDRESS) throw new Error("TRANSLATOR_AGENT_ADDRESS not set in .env");
if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set in .env");

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// x402 setup — pass AssetAmount directly to bypass DEFAULT_STABLECOINS lookup for Fuji
const evmScheme = new ExactEvmScheme();
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator)
  .register(FUJI_NETWORK, evmScheme);

const app = express();
app.use(express.json());

// Payment-gated translation endpoint
app.use(
  paymentMiddleware(
    {
      "POST /execute": {
        accepts: {
          scheme: "exact",
          price: {
            amount: TRANSLATION_PRICE_RAW,
            asset: USDC_FUJI,
            extra: {
              name: "USD Coin",
              version: "2",
              decimals: USDC_DECIMALS,
            },
          },
          network: FUJI_NETWORK,
          payTo: TRANSLATOR_ADDRESS,
          maxTimeoutSeconds: 60,
        },
        description: "Translate text to Spanish using Claude AI — 0.01 USDC",
      },
    },
    resourceServer,
  ),
);

app.post("/execute", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'text' field in request body" });
    return;
  }

  const taskId = ethers.hexlify(ethers.randomBytes(32));

  try {
    let translatedText: string;

    if (process.env.MOCK_TRANSLATION === "true") {
      // Test mode — bypass Claude to validate x402 payment settlement without API credits
      translatedText = `[MOCK] Hola, esto es una prueba del sistema de pagos TaskChain en Avalanche Fuji.`;
    } else {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Translate the following text to Spanish. Return ONLY the translation, no explanation:\n\n${text}`,
          },
        ],
      });
      translatedText =
        message.content[0].type === "text" ? message.content[0].text : "";
    }

    // Record completion on-chain if registry is configured
    if (AGENT_REGISTRY_ADDRESS && process.env.TRANSLATOR_AGENT_PRIVATE_KEY) {
      recordCompletionOnChain(taskId, true).catch((e) =>
        console.error("on-chain record failed:", e.message),
      );
    }

    res.json({
      taskId,
      originalText: text,
      translatedText,
      language: "es",
      model: "claude-sonnet-4-20250514",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Translation error:", message);

    if (AGENT_REGISTRY_ADDRESS && process.env.TRANSLATOR_AGENT_PRIVATE_KEY) {
      recordCompletionOnChain(taskId, false).catch(() => {});
    }

    res.status(500).json({ error: "Translation failed", details: message });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    agent: "translator",
    address: TRANSLATOR_ADDRESS,
    network: FUJI_NETWORK,
    price: `${parseInt(TRANSLATION_PRICE_RAW) / 10 ** USDC_DECIMALS} USDC`,
  });
});

async function recordCompletionOnChain(taskId: string, success: boolean) {
  const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
  const wallet = new ethers.Wallet(process.env.TRANSLATOR_AGENT_PRIVATE_KEY!, provider);

  const abi = [
    "function recordCompletion(address agent, bytes32 taskId, bool success) external",
  ];
  const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS!, abi, wallet);
  const tx = await registry.recordCompletion(TRANSLATOR_ADDRESS, taskId, success);
  console.log(`Reputation recorded on-chain: ${tx.hash} (success=${success})`);
}

app.listen(TRANSLATOR_PORT, () => {
  console.log(`\nTranslator agent running on port ${TRANSLATOR_PORT}`);
  console.log(`  Address:     ${TRANSLATOR_ADDRESS}`);
  console.log(`  Network:     ${FUJI_NETWORK}`);
  console.log(`  Price:       ${parseInt(TRANSLATION_PRICE_RAW) / 10 ** USDC_DECIMALS} USDC`);
  console.log(`  Facilitator: ${FACILITATOR_URL}`);
  console.log(`  POST http://localhost:${TRANSLATOR_PORT}/execute\n`);
});
