/**
 * Test script for the Phase 5 auth flow.
 *
 * Uses PRIVY_SKIP_VERIFY=true mode so no real Privy credentials are needed.
 * The API server must be running: npx ts-node api/index.ts
 * (with DATABASE_URL and PRIVY_SKIP_VERIFY=true set in .env)
 *
 * Run: npx ts-node scripts/test-auth.ts
 */
import "dotenv/config";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";
const JWT_SECRET = process.env.JWT_SECRET ?? "taskchain-dev-secret";

async function main() {
  console.log("[test-auth] API:", API_BASE);

  // 1. Generate a fresh test wallet
  const wallet = ethers.Wallet.createRandom();
  const walletAddress = wallet.address.toLowerCase();
  console.log("[test-auth] Test wallet:", walletAddress);

  // 2. Call POST /auth/verify in skip-verify mode
  const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(`/auth/verify failed: ${JSON.stringify(err)}`);
  }

  const { token, user } = (await verifyRes.json()) as {
    token: string;
    user: { id: string; walletAddress: string; username: string | null };
  };

  console.log("[test-auth] ✅ User upserted:", user.id, user.walletAddress);

  // 3. Verify JWT is correctly signed
  const payload = jwt.verify(token, JWT_SECRET) as { userId: string; walletAddress: string };
  console.log("[test-auth] ✅ JWT valid — userId:", payload.userId, "wallet:", payload.walletAddress);

  if (payload.walletAddress !== walletAddress) {
    throw new Error(`JWT wallet mismatch: ${payload.walletAddress} !== ${walletAddress}`);
  }

  // 4. Use JWT to fetch profile from GET /users/me
  const meRes = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!meRes.ok) {
    const err = await meRes.json();
    throw new Error(`/users/me failed: ${JSON.stringify(err)}`);
  }

  const profile = (await meRes.json()) as { id: string; walletAddress: string; username: string | null };
  console.log("[test-auth] ✅ GET /users/me:", profile.id, profile.walletAddress);

  // 5. Update profile via PUT /users/me
  const putRes = await fetch(`${API_BASE}/users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ username: "test_user_" + wallet.address.slice(2, 6), bio: "Test bio" }),
  });

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(`PUT /users/me failed: ${JSON.stringify(err)}`);
  }

  const updated = (await putRes.json()) as { username: string | null };
  console.log("[test-auth] ✅ PUT /users/me — username:", updated.username);

  // 6. Fetch public profile via GET /users/:id
  const pubRes = await fetch(`${API_BASE}/users/${user.id}`);
  if (!pubRes.ok) throw new Error("GET /users/:id failed");
  const pub = (await pubRes.json()) as { walletAddress: string };
  console.log("[test-auth] ✅ GET /users/:id — public wallet:", pub.walletAddress);

  // 7. Confirm second login upserts same user (idempotent)
  const second = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  const { user: sameUser } = (await second.json()) as { user: { id: string } };
  if (sameUser.id !== user.id) throw new Error("Upsert created duplicate user!");
  console.log("[test-auth] ✅ Idempotent upsert confirmed — same userId on second login");

  console.log("\n[test-auth] 🎉 All checks passed.");
}

main().catch((e) => {
  console.error("[test-auth] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
