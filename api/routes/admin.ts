import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

const ADMIN_WALLET = (process.env.ADMIN_WALLET_ADDRESS ?? "").toLowerCase();

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!req.user) { res.status(401).json({ error: "Unauthenticated" }); return; }
  if (!ADMIN_WALLET) { res.status(503).json({ error: "ADMIN_WALLET_ADDRESS not configured" }); return; }
  if (req.user.walletAddress?.toLowerCase() !== ADMIN_WALLET) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}

// GET /admin/treasury — sum of 5% platform fees from all completed tasks
router.get(
  "/treasury",
  requireAuth,
  (req, res, next) => { requireAdmin(req, res, next as () => void); },
  async (_req: Request, res: Response): Promise<void> => {
    const completedTasks = await prisma.task.findMany({
      where: { status: "COMPLETE" },
      include: {
        steps: {
          include: { agent: { select: { priceUsdc: true } } },
        },
      },
    });

    let totalFees = 0;
    let totalVolume = 0;
    for (const task of completedTasks) {
      const agentTotal = task.steps.reduce((s, step) => s + step.agent.priceUsdc, 0);
      const fee = Math.max(0, (task.totalCostUsdc ?? 0) - agentTotal);
      totalFees += fee;
      totalVolume += task.totalCostUsdc ?? 0;
    }

    res.json({
      completedTasks: completedTasks.length,
      totalVolumeUsdc: totalVolume,
      platformFeesUsdc: totalFees,
      treasuryAddress: process.env.TREASURY_ADDRESS ?? null,
    });
  },
);

export default router;
