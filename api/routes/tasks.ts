import { Router, type Request, type Response } from "express";
import { ethers } from "ethers";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";
import { io } from "../index";
import { executeTask } from "../../services/taskExecutor";

const createTaskSchema = z.object({
  pipeline: z.array(
    z.object({
      agentId: z.string().min(1),
      stepContext: z.string().max(2000).optional(),
    }),
  ).min(1).max(20),
  inputPayload: z.object({
    text: z.string().max(10_000).optional(),
    data: z.unknown().optional(),
  }).optional(),
});

const router = Router();
const PLATFORM_FEE = 1.05;
const ESCROW_ADDRESS = process.env.SATISFACTION_ESCROW_ADDRESS ?? "";

// POST /tasks — create pipeline task record + return escrow calldata for frontend
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const { pipeline, inputPayload } = parsed.data;

  const agentIds = [...new Set(pipeline.map((s) => s.agentId))];
  const agents = await prisma.agent.findMany({
    where: { id: { in: agentIds }, isActive: true },
    select: { id: true, priceUsdc: true, name: true, agentWalletAddress: true },
  });
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  for (const step of pipeline) {
    if (!agentMap.has(step.agentId)) {
      res.status(400).json({ error: `Agent ${step.agentId} not found or inactive` });
      return;
    }
  }

  const subtotal = pipeline.reduce((sum, step) => sum + agentMap.get(step.agentId)!.priceUsdc, 0);
  const totalCostUsdc = Math.ceil(subtotal * PLATFORM_FEE);

  const task = await prisma.task.create({
    data: {
      userId: req.user!.userId,
      pipeline: pipeline as unknown as Prisma.InputJsonValue,
      inputPayload: ((inputPayload ?? {}) as unknown) as Prisma.InputJsonValue,
      totalCostUsdc,
      status: "PENDING",
      steps: {
        create: pipeline.map((step, i) => ({
          agentId: step.agentId,
          stepIndex: i,
          stepContext: step.stepContext ?? null,
          status: "PENDING" as const,
        })),
      },
    },
    include: {
      steps: {
        orderBy: { stepIndex: "asc" },
        include: {
          agent: {
            select: { id: true, name: true, priceUsdc: true, agentWalletAddress: true },
          },
        },
      },
    },
  });

  // Build escrow calldata for the frontend to sign
  // taskId32 = keccak256(utf8(taskId)) — fits in bytes32
  const taskId32 = ethers.keccak256(ethers.toUtf8Bytes(task.id));
  const agentAddresses = task.steps.map(
    (s) => agentMap.get(s.agentId)?.agentWalletAddress ?? ethers.ZeroAddress,
  );
  const agentAmounts = task.steps.map((s) => agentMap.get(s.agentId)!.priceUsdc);

  res.status(201).json({
    taskId: task.id,
    taskId32,
    escrowContract: ESCROW_ADDRESS,
    agentAddresses,
    agentAmounts,
    totalCostUsdc,
    status: task.status,
    steps: task.steps,
  });
});

// POST /tasks/:id/start — triggered by frontend after escrow is funded
router.post("/:id/start", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params["id"] as string;
  const { fundingTxHash } = req.body as { fundingTxHash?: string };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  if (task.userId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (task.status !== "PENDING") {
    res.status(400).json({ error: `Task already in status: ${task.status}` });
    return;
  }

  // Store funding tx hash
  await prisma.task.update({
    where: { id: taskId },
    data: { escrowTxHash: fundingTxHash ?? null },
  });

  // Kick off async execution (non-blocking)
  executeTask(taskId, io).catch((e: unknown) =>
    console.error("[tasks] executor error:", e instanceof Error ? e.message : e),
  );

  res.status(202).json({ message: "Execution started", taskId });
});

// POST /tasks/:id/approve — called after user signs approveTask on-chain
router.post("/:id/approve", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params["id"] as string;
  const { approveTxHash } = req.body as { approveTxHash?: string };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  if (task.userId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (task.status !== "AWAITING_APPROVAL") {
    res.status(400).json({ error: `Cannot approve task in status: ${task.status}` });
    return;
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETE",
      completedAt: new Date(),
      escrowTxHash: approveTxHash ?? task.escrowTxHash,
    },
  });

  io.to(`task:${taskId}`).emit("task:approved", { taskId });
  res.json({ success: true, status: updated.status });
});

// POST /tasks/:id/dispute — called after user signs disputeTask on-chain
router.post("/:id/dispute", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params["id"] as string;
  const { reason, disputeTxHash } = req.body as { reason?: string; disputeTxHash?: string };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  if (task.userId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (task.status !== "AWAITING_APPROVAL") {
    res.status(400).json({ error: `Cannot dispute task in status: ${task.status}` });
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "DISPUTED",
      escrowTxHash: disputeTxHash ?? task.escrowTxHash,
    },
  });

  io.to(`task:${taskId}`).emit("task:disputed", { taskId, reason });
  res.json({ success: true, status: "DISPUTED" });
});

// GET /tasks/my — current user's task history (must be before /:id)
router.get("/my", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const tasks = await prisma.task.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      steps: {
        orderBy: { stepIndex: "asc" },
        include: { agent: { select: { id: true, name: true, priceUsdc: true } } },
      },
    },
  });
  res.json(tasks);
});

// GET /tasks/:id — task detail with steps, agents, reviews
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const task = await prisma.task.findUnique({
    where: { id: req.params["id"] as string },
    include: {
      steps: {
        orderBy: { stepIndex: "asc" },
        include: {
          agent: {
            select: {
              id: true, name: true, priceUsdc: true,
              agentWalletAddress: true, reputationScore: true,
            },
          },
          reviews: {
            include: { user: { select: { id: true, username: true, walletAddress: true } } },
          },
        },
      },
      user: { select: { id: true, username: true, walletAddress: true } },
    },
  });
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

// POST /tasks/:taskId/steps/:stepId/review — submit or update a 1-5 star review
router.post(
  "/:taskId/steps/:stepId/review",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { rating, comment } = req.body as { rating?: number; comment?: string };
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be an integer 1–5" });
      return;
    }

    const step = await prisma.taskStep.findFirst({
      where: {
        id: req.params["stepId"] as string,
        taskId: req.params["taskId"] as string,
      },
    });
    if (!step) { res.status(404).json({ error: "Step not found" }); return; }

    const review = await prisma.review.upsert({
      where: { taskStepId_userId: { taskStepId: step.id, userId: req.user!.userId } },
      create: {
        taskStepId: step.id,
        agentId: step.agentId,
        userId: req.user!.userId,
        rating,
        comment: comment ?? null,
      },
      update: { rating, comment: comment ?? null },
    });
    res.json(review);
  },
);

export default router;
