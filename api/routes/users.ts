import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";

const updateProfileSchema = z.object({
  username: z.string().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/, "alphanumeric, _ and - only").optional(),
  bio: z.string().max(300).optional(),
});

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
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: parsed.data,
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
