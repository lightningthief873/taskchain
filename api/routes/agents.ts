import { Router, type Request, type Response } from "express";
import multer from "multer";
import { ethers } from "ethers";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";
import { encryptPrivateKey } from "../lib/crypto";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const RUNNER_BASE = process.env.RUNNER_URL ?? "http://localhost:4000";
const FUJI_RPC = process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS ?? "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const STAKING_ADDRESS = process.env.TASK_STAKING_ADDRESS ?? "";

const STAKING_ABI = [
  "function getStake(address user) view returns (uint256)",
  "function isVerifiedStaker(address user) view returns (bool)",
  "function minStakeVerified() view returns (uint256)",
];

const REGISTRY_ABI = [
  "function registerAgent(address agent, string calldata metadataURI) external",
  "function isRegistered(address agent) external view returns (bool)",
];

async function registerOnChain(agentWalletAddress: string, metadataURI: string) {
  if (!AGENT_REGISTRY_ADDRESS || !DEPLOYER_PRIVATE_KEY) return;
  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, REGISTRY_ABI, deployer);
    const isReg = await registry.isRegistered(agentWalletAddress);
    if (!isReg) {
      const tx = await registry.registerAgent(agentWalletAddress, metadataURI);
      console.log(`[agents] Registered on-chain: ${tx.hash}`);
    }
  } catch (e) {
    console.warn("[agents] On-chain registration failed:", e instanceof Error ? e.message : e);
  }
}

// POST /agents — create agent
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, description, systemPrompt, contextText, priceUsdc } = req.body as {
    name?: string;
    description?: string;
    systemPrompt?: string;
    contextText?: string;
    priceUsdc?: number;
  };

  if (!name || typeof priceUsdc !== "number" || priceUsdc < 0) {
    res.status(400).json({ error: "name and priceUsdc (>= 0) are required" });
    return;
  }

  const wallet = ethers.Wallet.createRandom();
  const encKey = encryptPrivateKey(wallet.privateKey);
  const priceRaw = Math.round(priceUsdc * 1_000_000); // convert to 6-decimal integer

  const agent = await prisma.agent.create({
    data: {
      ownerId: req.user!.userId,
      name,
      description,
      systemPrompt,
      contextText,
      priceUsdc: priceRaw,
      endpoint: `${RUNNER_BASE}/run/PLACEHOLDER`, // updated after insert
      agentWalletAddress: wallet.address.toLowerCase(),
      encryptedPrivateKey: encKey,
    },
  });

  // Update endpoint with real agent ID
  const updated = await prisma.agent.update({
    where: { id: agent.id },
    data: { endpoint: `${RUNNER_BASE}/run/${agent.id}` },
  });

  // Register on-chain in background (don't block response)
  registerOnChain(wallet.address, `taskchain:agent:${agent.id}`).catch(() => {});

  res.status(201).json({ ...updated, encryptedPrivateKey: undefined });
});

// GET /agents — marketplace feed
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { sort = "newest", search } = req.query as {
    sort?: "price" | "reputation" | "newest";
    search?: string;
  };

  const orderBy =
    sort === "price"
      ? { priceUsdc: "asc" as const }
      : sort === "reputation"
        ? { reputationScore: "desc" as const }
        : { createdAt: "desc" as const };

  const agents = await prisma.agent.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy,
    select: {
      id: true,
      name: true,
      description: true,
      priceUsdc: true,
      endpoint: true,
      agentWalletAddress: true,
      reputationScore: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      owner: { select: { id: true, username: true, walletAddress: true } },
    },
  });
  res.json(agents);
});

// GET /agents/:id/reviews — recent reviews for an agent (must be before /:id)
router.get("/:id/reviews", async (req: Request, res: Response): Promise<void> => {
  const reviews = await prisma.review.findMany({
    where: { agentId: req.params["id"] as string },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { id: true, username: true, walletAddress: true } } },
  });
  res.json(reviews);
});

// GET /agents/:id — single agent detail
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params["id"] as string },
    select: {
      id: true,
      name: true,
      description: true,
      systemPrompt: true,
      contextText: true,
      priceUsdc: true,
      endpoint: true,
      agentWalletAddress: true,
      reputationScore: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      owner: { select: { id: true, username: true, walletAddress: true } },
    },
  });
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

// PUT /agents/:id — update (owner only)
router.put("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const agentId = req.params["id"] as string;
  const existing = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!existing) { res.status(404).json({ error: "Agent not found" }); return; }
  if (existing.ownerId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, description, systemPrompt, contextText, priceUsdc } = req.body as {
    name?: string; description?: string; systemPrompt?: string; contextText?: string; priceUsdc?: number;
  };

  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(contextText !== undefined && { contextText }),
      ...(priceUsdc !== undefined && { priceUsdc: Math.round(priceUsdc * 1_000_000) }),
    },
    select: {
      id: true, name: true, description: true, systemPrompt: true, contextText: true,
      priceUsdc: true, endpoint: true, agentWalletAddress: true, reputationScore: true,
      isActive: true, isVerified: true, createdAt: true,
    },
  });
  res.json(updated);
});

// DELETE /agents/:id — deactivate (owner only)
router.delete("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const agentId = req.params["id"] as string;
  const existing = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!existing) { res.status(404).json({ error: "Agent not found" }); return; }
  if (existing.ownerId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await prisma.agent.update({ where: { id: agentId }, data: { isActive: false } });
  res.json({ success: true });
});

// POST /agents/:id/context-file — upload .txt or .pdf as context
router.post(
  "/:id/context-file",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const agentId = req.params["id"] as string;
    const existing = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!existing) { res.status(404).json({ error: "Agent not found" }); return; }
    if (existing.ownerId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

    let contextText = "";
    const mime = file.mimetype;

    if (mime === "text/plain" || file.originalname.endsWith(".txt")) {
      contextText = file.buffer.toString("utf8");
    } else if (mime === "application/pdf" || file.originalname.endsWith(".pdf")) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(file.buffer);
      contextText = result.text;
    } else {
      res.status(400).json({ error: "Only .txt and .pdf files are supported" });
      return;
    }

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: { contextText: contextText.slice(0, 50_000) }, // cap at 50k chars
    });

    res.json({ success: true, contextLength: contextText.length, agentId: updated.id });
  },
);

// POST /agents/:id/verify — on-chain staking check → set isVerified if stake >= min
// Owner-only: reads TaskStaking.getStake(ownerWalletAddress) and updates DB if qualified.
router.post("/:id/verify", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const agentId = req.params["id"] as string;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { owner: { select: { walletAddress: true } } },
  });
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
  if (agent.ownerId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  if (!STAKING_ADDRESS) {
    res.status(503).json({ error: "TASK_STAKING_ADDRESS not configured" });
    return;
  }

  const ownerWallet = agent.owner.walletAddress;
  let verified = false;
  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);
    verified = (await staking.isVerifiedStaker(ownerWallet)) as boolean;
  } catch (e) {
    res.status(502).json({ error: "On-chain check failed: " + (e instanceof Error ? e.message : String(e)) });
    return;
  }

  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: { isVerified: verified },
    select: {
      id: true, name: true, isVerified: true, reputationScore: true,
      agentWalletAddress: true,
    },
  });

  res.json({ ...updated, qualified: verified });
});

// POST /agents/:id/rate — simple rating for agent after task completion
// body: { taskId, stars: 1-5, comment }
// Finds the TaskStep for this agent in the given task and upserts a Review.
router.post("/:id/rate", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const agentId = req.params["id"] as string;
  const { taskId, stars, comment } = req.body as {
    taskId?: string;
    stars?: number;
    comment?: string;
  };

  if (!taskId) { res.status(400).json({ error: "taskId is required" }); return; }
  if (!stars || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    res.status(400).json({ error: "stars must be an integer 1–5" });
    return;
  }

  const step = await prisma.taskStep.findFirst({
    where: { taskId, agentId },
    orderBy: { stepIndex: "asc" },
  });
  if (!step) { res.status(404).json({ error: "No matching step found for this agent/task" }); return; }

  const review = await prisma.review.upsert({
    where: { taskStepId_userId: { taskStepId: step.id, userId: req.user!.userId } },
    create: {
      taskStepId: step.id,
      agentId,
      userId: req.user!.userId,
      rating: stars,
      comment: comment ?? null,
    },
    update: { rating: stars, comment: comment ?? null },
  });
  res.json(review);
});

export default router;
