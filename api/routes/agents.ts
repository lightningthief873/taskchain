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
      isActive: true, createdAt: true,
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

export default router;
