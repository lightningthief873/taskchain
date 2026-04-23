import { Router, type Request, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();
const PLATFORM_FEE = 1.05;

interface PipelineEntry {
  agentId: string;
  stepContext?: string;
}

// POST /tasks — create pipeline task record (execution is Phase 8)
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pipeline, inputPayload } = req.body as {
    pipeline?: PipelineEntry[];
    inputPayload?: { text?: string; data?: unknown };
  };

  if (!pipeline || !Array.isArray(pipeline) || pipeline.length === 0) {
    res.status(400).json({ error: "pipeline must be a non-empty array" });
    return;
  }

  const agentIds = [...new Set(pipeline.map((s) => s.agentId))];
  const agents = await prisma.agent.findMany({
    where: { id: { in: agentIds }, isActive: true },
    select: { id: true, priceUsdc: true, name: true },
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
          agent: { select: { id: true, name: true, priceUsdc: true, agentWalletAddress: true } },
        },
      },
    },
  });

  res.status(201).json({
    taskId: task.id,
    totalCostUsdc,
    escrowAddress: null, // populated in Phase 8
    status: task.status,
    steps: task.steps,
  });
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
            select: { id: true, name: true, priceUsdc: true, agentWalletAddress: true, reputationScore: true },
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
      where: { id: req.params["stepId"] as string, taskId: req.params["taskId"] as string },
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
