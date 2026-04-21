import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

// GET /users/me
router.get("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { agents: { where: { isActive: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

// PUT /users/me
router.put("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { username, bio } = req.body as { username?: string; bio?: string };
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { username, bio },
  });
  res.json(user);
});

// GET /users/:id — public profile
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.params["id"] as string },
    include: { agents: { where: { isActive: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

export default router;
