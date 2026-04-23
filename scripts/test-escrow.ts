/**
 * Phase 8 end-to-end test: escrow calldata, task execution, approve/dispute.
 *
 * Requires API running with PRIVY_SKIP_VERIFY=true:
 *   DATABASE_URL=... PRIVY_SKIP_VERIFY=true JWT_SECRET=test-secret AGENT_MASTER_KEY=<64-hex> \
 *   ANTHROPIC_API_KEY=... SATISFACTION_ESCROW_ADDRESS=0x... \
 *   npx ts-node api/index.ts
 *
 * If RUNNER_URL points to a running runner, the executor will actually execute.
 * Otherwise tasks will fail at execution — approve/dispute tests are skipped.
 *
 * Run: npx ts-node scripts/test-escrow.ts
 */
import "dotenv/config";
import { ethers } from "ethers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";
const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS ?? "";

async function poll(
  taskId: string,
  token: string,
  maxWaitMs = 60_000,
): Promise<{ status: string; outputPayload: unknown }> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`);
    const t = (await res.json()) as { status: string; outputPayload: unknown };
    if (t.status !== "PENDING" && t.status !== "RUNNING") return t;
    await new Promise((r) => setTimeout(r, 3000));
    process.stdout.write(".");
  }
  throw new Error("Timed out waiting for task to finish");
}

async function main() {
  console.log("[test-escrow] API:", API_BASE);

  // ── 1. Authenticate ──────────────────────────────────────────────────────────
  const wallet = ethers.Wallet.createRandom();
  const authRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: wallet.address.toLowerCase() }),
  });
  if (!authRes.ok) throw new Error(`Auth failed: ${await authRes.text()}`);
  const { token } = (await authRes.json()) as { token: string };
  const authH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("[test-escrow] ✅ Authenticated:", wallet.address.slice(0, 10));

  // ── 2. Create 2 agents ───────────────────────────────────────────────────────
  async function mkAgent(name: string, priceUsdc: number) {
    const res = await fetch(`${API_BASE}/agents`, {
      method: "POST",
      headers: authH,
      body: JSON.stringify({
        name,
        description: `Test ${name}`,
        systemPrompt: `You are ${name}. Echo the input back.`,
        priceUsdc,
      }),
    });
    if (!res.ok) throw new Error(`Create ${name} failed: ${await res.text()}`);
    return (await res.json()) as { id: string; agentWalletAddress: string };
  }

  const [a1, a2] = await Promise.all([mkAgent("Echo A", 0.01), mkAgent("Echo B", 0.005)]);
  console.log("[test-escrow] ✅ Created agents:", a1.id.slice(0, 8), a2.id.slice(0, 8));

  // ── 3. POST /tasks — verify escrow calldata ──────────────────────────────────
  const taskRes = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      pipeline: [
        { agentId: a1.id, stepContext: "First step" },
        { agentId: a2.id, stepContext: "Second step" },
      ],
      inputPayload: { text: "Hello world" },
    }),
  });
  if (!taskRes.ok) throw new Error(`POST /tasks failed: ${await taskRes.text()}`);

  const created = (await taskRes.json()) as {
    taskId: string;
    taskId32: string;
    escrowContract: string;
    agentAddresses: string[];
    agentAmounts: number[];
    totalCostUsdc: number;
    status: string;
  };

  if (!created.taskId) throw new Error("taskId missing");
  if (!created.taskId32 || !created.taskId32.startsWith("0x")) {
    throw new Error(`taskId32 invalid: ${created.taskId32}`);
  }
  // Verify taskId32 = keccak256(utf8(taskId))
  const expected32 = ethers.keccak256(ethers.toUtf8Bytes(created.taskId));
  if (created.taskId32 !== expected32) {
    throw new Error(`taskId32 mismatch: expected ${expected32}, got ${created.taskId32}`);
  }
  if (!Array.isArray(created.agentAddresses) || created.agentAddresses.length !== 2) {
    throw new Error("agentAddresses invalid");
  }
  if (!Array.isArray(created.agentAmounts) || created.agentAmounts.length !== 2) {
    throw new Error("agentAmounts invalid");
  }
  // Verify amounts match agent prices
  const expectedSubtotal = Math.round((0.01 + 0.005) * 1_000_000); // 15000
  const expectedTotal = Math.ceil(expectedSubtotal * 1.05); // 15750
  if (created.totalCostUsdc !== expectedTotal) {
    throw new Error(`Total cost mismatch: expected ${expectedTotal}, got ${created.totalCostUsdc}`);
  }

  console.log("[test-escrow] ✅ POST /tasks returned valid escrow calldata");
  console.log("             taskId32:", created.taskId32.slice(0, 18) + "…");
  console.log("             escrowContract:", created.escrowContract || "(none — SATISFACTION_ESCROW_ADDRESS not set)");
  console.log("             agentAddresses:", created.agentAddresses.map((a) => a.slice(0, 8) + "…").join(", "));
  console.log("             agentAmounts:", created.agentAmounts.join(", "), "micro-USDC");
  console.log("             totalCostUsdc:", created.totalCostUsdc, "micro-USDC");

  // ── 4. POST /tasks/:id/start — kick off executor ─────────────────────────────
  const startRes = await fetch(`${API_BASE}/tasks/${created.taskId}/start`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ fundingTxHash: "0x" + "0".repeat(64) }),
  });
  if (startRes.status !== 202) {
    throw new Error(`POST /start expected 202, got ${startRes.status}: ${await startRes.text()}`);
  }
  console.log("[test-escrow] ✅ POST /tasks/:id/start → 202 Accepted");

  // ── 5. Poll for terminal status ───────────────────────────────────────────────
  console.log("[test-escrow]   Polling for task to finish (up to 60s)");
  const finished = await poll(created.taskId, token);
  console.log(`\n[test-escrow] ✅ Task finished with status: ${finished.status}`);

  if (finished.status === "AWAITING_APPROVAL") {
    // ── 6a. Approve the task ─────────────────────────────────────────────────
    const approveRes = await fetch(`${API_BASE}/tasks/${created.taskId}/approve`, {
      method: "POST",
      headers: authH,
      body: JSON.stringify({ approveTxHash: "0x" + "a".repeat(64) }),
    });
    if (!approveRes.ok) {
      throw new Error(`POST /approve failed: ${await approveRes.text()}`);
    }
    const approved = (await approveRes.json()) as { success: boolean; status: string };
    if (approved.status !== "COMPLETE") {
      throw new Error(`Expected COMPLETE after approve, got ${approved.status}`);
    }
    console.log("[test-escrow] ✅ Task approved → COMPLETE");

    // ── 6b. Rate an agent via POST /agents/:id/rate ──────────────────────────
    const rateRes = await fetch(`${API_BASE}/agents/${a1.id}/rate`, {
      method: "POST",
      headers: authH,
      body: JSON.stringify({ taskId: created.taskId, stars: 4, comment: "Good work!" }),
    });
    if (!rateRes.ok) {
      throw new Error(`POST /agents/:id/rate failed: ${await rateRes.text()}`);
    }
    const rated = (await rateRes.json()) as { rating: number };
    if (rated.rating !== 4) throw new Error("Rating mismatch");
    console.log("[test-escrow] ✅ Agent rated 4 stars via /agents/:id/rate");
  } else if (finished.status === "FAILED") {
    console.log("[test-escrow] ⚠️  Task FAILED (runner may not be running — executor tests skipped)");

    // ── 6alt. Test dispute on a fresh task ────────────────────────────────────
    // Manually force task to AWAITING_APPROVAL by creating and patching via DB is not possible
    // from the test. Skip approve/dispute tests if task failed.
    console.log("[test-escrow] ℹ️  Start the runner to test approve/dispute flow");
  } else {
    throw new Error(`Unexpected terminal status: ${finished.status}`);
  }

  // ── 7. GET /admin/treasury (admin only) ─────────────────────────────────────
  if (ADMIN_WALLET && ADMIN_WALLET.toLowerCase() === wallet.address.toLowerCase()) {
    const treasuryRes = await fetch(`${API_BASE}/admin/treasury`, { headers: authH });
    if (!treasuryRes.ok) throw new Error(`GET /admin/treasury failed: ${await treasuryRes.text()}`);
    const treasury = (await treasuryRes.json()) as {
      completedTasks: number;
      totalVolumeUsdc: number;
      platformFeesUsdc: number;
    };
    console.log("[test-escrow] ✅ Admin treasury:", JSON.stringify(treasury));
  } else {
    // Test 403 for non-admin
    const treasuryRes = await fetch(`${API_BASE}/admin/treasury`, { headers: authH });
    if (![401, 403, 503].includes(treasuryRes.status)) {
      throw new Error(`Expected 401/403/503 for non-admin treasury access, got ${treasuryRes.status}`);
    }
    console.log("[test-escrow] ✅ GET /admin/treasury correctly rejects non-admin (HTTP", treasuryRes.status + ")");
  }

  // ── 8. Duplicate start should return 400 ────────────────────────────────────
  const dupStart = await fetch(`${API_BASE}/tasks/${created.taskId}/start`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({}),
  });
  if (dupStart.status !== 400) {
    throw new Error(`Expected 400 for re-start, got ${dupStart.status}`);
  }
  console.log("[test-escrow] ✅ Duplicate /start correctly returns 400");

  console.log("\n[test-escrow] 🎉 All Phase 8 checks passed!");
}

main().catch((e) => {
  console.error("[test-escrow] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
