import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "../prisma";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "taskchain-dev-secret";
const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";
const PRIVY_SKIP_VERIFY = process.env.PRIVY_SKIP_VERIFY === "true";

// Lazy-init so startup doesn't crash when PRIVY_APP_ID is missing (dev mode)
let privyClient: PrivyClient | null = null;
function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return privyClient;
}

router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    let walletAddress: string;

    if (PRIVY_SKIP_VERIFY) {
      // Dev/test mode: caller provides walletAddress directly
      walletAddress = req.body.walletAddress as string;
      if (!walletAddress) {
        res.status(400).json({ error: "walletAddress required in PRIVY_SKIP_VERIFY mode" });
        return;
      }
    } else {
      // Production: verify Privy access token
      const { accessToken } = req.body as { accessToken?: string };
      if (!accessToken) {
        res.status(400).json({ error: "accessToken required" });
        return;
      }
      const claims = await getPrivyClient().verifyAuthToken(accessToken);
      // verifyAuthToken only returns { userId, appId, ... } — fetch full user for wallet address
      const privyUser = await getPrivyClient().getUserById(claims.userId);
      const linkedWallet = privyUser.linkedAccounts?.find((a) => a.type === "wallet") as
        | { address?: string }
        | undefined;
      walletAddress = linkedWallet?.address ?? (privyUser.wallet?.address as string | undefined) ?? "";
      if (!walletAddress) {
        res.status(400).json({ error: "No wallet linked to this Privy account" });
        return;
      }
    }

    // Normalize to lowercase for consistent lookups
    walletAddress = walletAddress.toLowerCase();

    const user = await prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress },
      update: {},
    });

    const token = jwt.sign(
      { userId: user.id, walletAddress: user.walletAddress } satisfies { userId: string; walletAddress: string },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({ token, user: { id: user.id, walletAddress: user.walletAddress, username: user.username } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[auth] verify error:", msg);
    res.status(401).json({ error: "Authentication failed", details: msg });
  }
});

export default router;
