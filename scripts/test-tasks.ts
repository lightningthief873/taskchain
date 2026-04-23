/**
 * Phase 7 end-to-end test.
 *
 * Requires:
 *   DATABASE_URL=... PRIVY_SKIP_VERIFY=true JWT_SECRET=test-secret AGENT_MASTER_KEY=<64-hex> npx ts-node api/index.ts
 *
 * Run: npx ts-node scripts/test-tasks.ts
 */
import "dotenv/config";
import { ethers } from "ethers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

async function main() {
  console.log("[test-tasks] API:", API_BASE);

  // ── Step 1: Authenticate ─────────────────────────────────────────────────
  const wallet = ethers.Wallet.createRandom();
  const authRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: wallet.address.toLowerCase() }),
  });
  if (!authRes.ok) throw new Error(`Auth failed: ${await authRes.text()}`);
  const { token } = (await authRes.json()) as { token: string };
  const authH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("[test-tasks] ✅ Authenticated:", wallet.address.slice(0, 10));

  // ── Step 2: Create 3 agents ──────────────────────────────────────────────
  async function mkAgent(name: string, priceUsdc: number) {
    const res = await fetch(`${API_BASE}/agents`, {
      method: "POST",
      headers: authH,
      body: JSON.stringify({ name, description: `Test ${name}`, systemPrompt: `You are ${name}.`, priceUsdc }),
    });
    if (!res.ok) throw new Error(`Create ${name} failed: ${await res.text()}`);
    return (await res.json()) as { id: string };
  }

  const [a1, a2, a3] = await Promise.all([
    mkAgent("Summarizer", 0.01),
    mkAgent("Translator", 0.005),
    mkAgent("Formatter", 0.002),
  ]);
  console.log("[test-tasks] ✅ Created 3 agents:", a1.id.slice(0, 8), a2.id.slice(0, 8), a3.id.slice(0, 8));

  // ── Step 3: Browse marketplace ───────────────────────────────────────────
  const listRes = await fetch(`${API_BASE}/agents`);
  const list = (await listRes.json()) as Array<{ id: string }>;
  const ids = list.map((a) => a.id);
  if (![a1.id, a2.id, a3.id].every((id) => ids.includes(id))) {
    throw new Error("Not all agents visible in marketplace");
  }
  console.log("[test-tasks] ✅ All 3 agents visible in marketplace");

  // ── Step 4: POST /tasks — create pipeline ────────────────────────────────
  const pipeline = [
    { agentId: a1.id, stepContext: "Summarize in 2 sentences" },
    { agentId: a2.id, stepContext: "Translate to Spanish" },
    { agentId: a3.id, stepContext: "Format as bullet points" },
  ];

  const taskRes = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      pipeline,
      inputPayload: { text: "The quick brown fox jumps over the lazy dog." },
    }),
  });
  if (!taskRes.ok) throw new Error(`POST /tasks failed: ${await taskRes.text()}`);
  const task = (await taskRes.json()) as {
    taskId: string;
    totalCostUsdc: number;
    status: string;
    steps: Array<{ id: string; stepIndex: number; agentId: string }>;
  };
  console.log("[test-tasks] ✅ Task created:", task.taskId.slice(0, 8), "status:", task.status);

  // ── Step 5: Verify total cost = sum * 1.05 (rounded up) ─────────────────
  // Prices: 0.01 + 0.005 + 0.002 = 0.017 USDC = 17000 micro-USDC
  // With fee: ceil(17000 * 1.05) = ceil(17850) = 17850
  const expectedSubtotal = Math.round((0.01 + 0.005 + 0.002) * 1_000_000); // 17000
  const expectedTotal = Math.ceil(expectedSubtotal * 1.05); // 17850
  if (task.totalCostUsdc !== expectedTotal) {
    throw new Error(
      `Total cost mismatch: expected ${expectedTotal}, got ${task.totalCostUsdc}`,
    );
  }
  console.log("[test-tasks] ✅ Total cost correct:", task.totalCostUsdc, "micro-USDC (=", task.totalCostUsdc / 1e6, "USDC)");

  // ── Step 6: Verify pipeline JSON and steps stored correctly ──────────────
  if (task.steps.length !== 3) throw new Error(`Expected 3 steps, got ${task.steps.length}`);
  const sortedSteps = [...task.steps].sort((a, b) => a.stepIndex - b.stepIndex);
  if (
    sortedSteps[0].agentId !== a1.id ||
    sortedSteps[1].agentId !== a2.id ||
    sortedSteps[2].agentId !== a3.id
  ) {
    throw new Error("Steps have wrong agentIds or order");
  }
  console.log("[test-tasks] ✅ Pipeline JSON and steps verified in DB");

  // ── Step 7: GET /tasks/:id ────────────────────────────────────────────────
  const detailRes = await fetch(`${API_BASE}/tasks/${task.taskId}`);
  if (!detailRes.ok) throw new Error("GET /tasks/:id failed");
  const detail = (await detailRes.json()) as {
    id: string;
    status: string;
    totalCostUsdc: number;
    steps: Array<{ id: string; stepContext: string | null; agent: { name: string } }>;
  };
  if (detail.id !== task.taskId) throw new Error("Task ID mismatch in detail response");
  if (detail.steps[0].stepContext !== "Summarize in 2 sentences") {
    throw new Error("stepContext not persisted correctly");
  }
  console.log("[test-tasks] ✅ GET /tasks/:id — task detail returned with stepContext");

  // ── Step 8: GET /tasks/my ────────────────────────────────────────────────
  const myRes = await fetch(`${API_BASE}/tasks/my`, { headers: authH });
  if (!myRes.ok) throw new Error("GET /tasks/my failed");
  const myTasks = (await myRes.json()) as Array<{ id: string }>;
  if (!myTasks.some((t) => t.id === task.taskId)) {
    throw new Error("Task not in /tasks/my");
  }
  console.log("[test-tasks] ✅ GET /tasks/my — task appears in history");

  // ── Step 9: GET /agents/:id/reviews (empty initially) ───────────────────
  const reviewsRes = await fetch(`${API_BASE}/agents/${a1.id}/reviews`);
  if (!reviewsRes.ok) throw new Error("GET /agents/:id/reviews failed");
  const initReviews = (await reviewsRes.json()) as unknown[];
  if (!Array.isArray(initReviews)) throw new Error("Reviews not an array");
  console.log("[test-tasks] ✅ GET /agents/:id/reviews — returned", initReviews.length, "reviews (empty OK)");

  // ── Step 10: POST review ─────────────────────────────────────────────────
  const stepId = sortedSteps[0].id;
  const reviewRes = await fetch(`${API_BASE}/tasks/${task.taskId}/steps/${stepId}/review`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ rating: 5, comment: "Excellent summarizer!" }),
  });
  if (!reviewRes.ok) throw new Error(`POST review failed: ${await reviewRes.text()}`);
  const review = (await reviewRes.json()) as { rating: number };
  if (review.rating !== 5) throw new Error("Rating not saved correctly");
  console.log("[test-tasks] ✅ POST review — 5 stars saved");

  // ── Step 11: Verify review appears on agent ──────────────────────────────
  const afterReviewRes = await fetch(`${API_BASE}/agents/${a1.id}/reviews`);
  const afterReviews = (await afterReviewRes.json()) as Array<{ rating: number; comment: string }>;
  if (afterReviews.length !== 1 || afterReviews[0].rating !== 5) {
    throw new Error("Review not returned from GET /agents/:id/reviews after submit");
  }
  console.log("[test-tasks] ✅ Review visible on agent:", afterReviews[0].comment);

  console.log("\n[test-tasks] 🎉 All checks passed!");
}

main().catch((e) => {
  console.error("[test-tasks] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
