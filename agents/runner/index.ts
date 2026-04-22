import "dotenv/config";
import express, { type Request, type Response, type RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import Anthropic from "@anthropic-ai/sdk";
import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import { decryptPrivateKey } from "../../api/lib/crypto";
import {
  FUJI_RPC_URL,
  FUJI_NETWORK,
  USDC_FUJI,
  USDC_DECIMALS,
  FACILITATOR_URL,
  AGENT_REGISTRY_ADDRESS,
} from "../../shared/config";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.RUNNER_PORT ?? "4000", 10);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const prisma = new PrismaClient();
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

// x402 infrastructure — shared across all agent payment checks
const evmScheme = new ExactEvmScheme();
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(FUJI_NETWORK, evmScheme);

// One payment middleware per unique (agentId, priceUsdc, payTo) combo
const mwCache = new Map<string, RequestHandler>();

function getPaymentMiddleware(agentId: string, priceRaw: number, payTo: string): RequestHandler {
  const key = `${agentId}:${priceRaw}`;
  if (!mwCache.has(key)) {
    mwCache.set(
      key,
      paymentMiddleware(
        {
          [`POST /run/${agentId}`]: {
            accepts: {
              scheme: "exact",
              price: {
                amount: String(priceRaw),
                asset: USDC_FUJI,
                extra: { name: "USD Coin", version: "2", decimals: USDC_DECIMALS },
              },
              network: FUJI_NETWORK,
              payTo: payTo as `0x${string}`,
              maxTimeoutSeconds: 60,
            },
            description: `TaskChain agent execution — ${priceRaw / 10 ** USDC_DECIMALS} USDC`,
          },
        },
        resourceServer,
      ),
    );
  }
  return mwCache.get(key)!;
}

const REGISTRY_ABI = [
  "function recordCompletion(address agent, bytes32 taskId, bool success) external",
];

async function recordCompletion(agentWalletAddress: string, privateKey: string, taskId: string, success: boolean) {
  if (!AGENT_REGISTRY_ADDRESS) return;
  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, REGISTRY_ABI, wallet);
    const tx = await registry.recordCompletion(agentWalletAddress, taskId, success);
    console.log(`[runner] reputation recorded: ${tx.hash}`);
  } catch (e) {
    console.warn("[runner] recordCompletion failed:", e instanceof Error ? e.message : e);
  }
}

// GET /health
app.get("/health", (_req, res) => res.json({ status: "ok", service: "taskchain-runner", port: PORT }));

// POST /run/:agentId — dynamic x402 gated execution
app.post("/run/:agentId", async (req: Request, res: Response): Promise<void> => {
  const agentId = req.params["agentId"] as string;

  // 1. Load agent from DB
  const agent = await prisma.agent.findUnique({ where: { id: agentId } }).catch(() => null);
  if (!agent || !agent.isActive) {
    res.status(404).json({ error: "Agent not found or inactive" });
    return;
  }
  if (!agent.agentWalletAddress || !agent.encryptedPrivateKey) {
    res.status(500).json({ error: "Agent wallet not configured" });
    return;
  }

  // 2. Apply dynamic x402 payment middleware — it handles the 402 response and verification
  const paymentMw = getPaymentMiddleware(agentId, agent.priceUsdc, agent.agentWalletAddress);
  await new Promise<void>((resolve, reject) => {
    paymentMw(req, res, (err?: unknown) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve();
    });
  }).catch(() => {
    // Payment middleware already sent the 402 or error response — stop here
    return;
  });

  // If res was already sent by the payment middleware (402 or error), bail out
  if (res.headersSent) return;

  // 3. Execute — call Anthropic with system prompt + user input
  const taskId = ethers.hexlify(ethers.randomBytes(32));
  const inputText =
    typeof req.body?.input === "string"
      ? req.body.input
      : JSON.stringify(req.body?.input ?? req.body);

  let output: string;

  try {
    if (!anthropic) {
      // Mock mode — return a canned response when no API key is configured
      output = `[MOCK] Agent "${agent.name}" processed: ${inputText.slice(0, 100)}`;
    } else {
      const systemParts: string[] = [];
      if (agent.systemPrompt) systemParts.push(agent.systemPrompt);
      if (agent.contextText) systemParts.push(`\n\nContext:\n${agent.contextText}`);
      const systemPrompt = systemParts.join("") || "You are a helpful AI assistant.";

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: inputText }],
      });
      output = msg.content[0].type === "text" ? msg.content[0].text : "";
    }

    // 4. Record success on-chain (non-blocking)
    const privateKey = decryptPrivateKey(agent.encryptedPrivateKey);
    recordCompletion(agent.agentWalletAddress, privateKey, taskId, true).catch(() => {});

    // 5. Update reputationScore in DB (optimistic increment)
    prisma.agent.update({
      where: { id: agentId },
      data: { reputationScore: { increment: 1 } },
    }).catch(() => {});

    res.json({ agentId, taskId, output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[runner] execution error for ${agentId}:`, msg);

    if (agent.encryptedPrivateKey) {
      const privateKey = decryptPrivateKey(agent.encryptedPrivateKey);
      recordCompletion(agent.agentWalletAddress, privateKey, taskId, false).catch(() => {});
    }

    res.status(500).json({ error: "Agent execution failed", details: msg });
  }
});

app.listen(PORT, () => {
  console.log(`[runner] AgentRunner listening on port ${PORT}`);
  console.log(`[runner] Facilitator: ${FACILITATOR_URL}`);
  console.log(`[runner] Anthropic: ${anthropic ? "enabled" : "mock mode"}`);
});
