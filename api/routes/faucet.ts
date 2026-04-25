import { Router, type Request, type Response } from "express";
import { ethers } from "ethers";
import { requireAuth } from "../middleware/auth";

const router = Router();

const FAUCET_AMOUNT = ethers.parseUnits("1000", 18);
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h per wallet
const lastClaim = new Map<string, number>(); // walletAddress → timestamp

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

// POST /faucet/task — send 1,000 TASK to the caller's wallet (once per 24 h)
router.post("/task", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const wallet = req.user!.walletAddress.toLowerCase();

  const last = lastClaim.get(wallet) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < COOLDOWN_MS) {
    const next = new Date(last + COOLDOWN_MS).toISOString();
    res.status(429).json({ error: `Already claimed. Next claim after ${next}` });
    return;
  }

  const rpcUrl = process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  const tokenAddress = process.env.TASK_TOKEN_ADDRESS;

  if (!deployerKey || !tokenAddress) {
    res.status(503).json({ error: "Faucet not configured" });
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(deployerKey, provider);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const balance: bigint = await token.balanceOf(await signer.getAddress()) as bigint;
    if (balance < FAUCET_AMOUNT) {
      res.status(503).json({ error: "Faucet depleted — contact admin to refill" });
      return;
    }

    const tx: ethers.TransactionResponse = await token.transfer(wallet, FAUCET_AMOUNT) as ethers.TransactionResponse;
    await tx.wait(1);

    lastClaim.set(wallet, Date.now());
    res.json({ success: true, txHash: tx.hash, amount: "1000" });
  } catch (e) {
    console.error("[faucet] transfer failed:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Transfer failed" });
  }
});

export default router;
