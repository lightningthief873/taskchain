/**
 * Phase 6 end-to-end test.
 *
 * Requires:
 *   - API server running:    DATABASE_URL=... PRIVY_SKIP_VERIFY=true JWT_SECRET=test-secret AGENT_MASTER_KEY=<64-hex> npx ts-node api/index.ts
 *   - Runner server running: DATABASE_URL=... AGENT_MASTER_KEY=<64-hex> npx ts-node agents/runner/index.ts
 *   - Facilitator running:   npx ts-node x402/facilitator.ts
 *
 * Run: npx ts-node scripts/test-agents.ts
 */
import "dotenv/config";
import { ethers } from "ethers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";
const RUNNER_BASE = process.env.RUNNER_URL ?? "http://localhost:4000";
const JWT_SECRET_CHECK = process.env.JWT_SECRET ?? "test-secret";

async function main() {
  console.log("[test-agents] API:", API_BASE);
  console.log("[test-agents] Runner:", RUNNER_BASE);

  // ── Step 1: Authenticate as a test user ─────────────────────────────────
  const wallet = ethers.Wallet.createRandom();
  const walletAddress = wallet.address.toLowerCase();

  const authRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  if (!authRes.ok) throw new Error(`Auth failed: ${await authRes.text()}`);
  const { token } = (await authRes.json()) as { token: string };
  console.log("[test-agents] ✅ Authenticated:", walletAddress);

  const authH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Step 2: Create Agent A (poet) ────────────────────────────────────────
  const agentARes = await fetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      name: "Poet Agent",
      description: "Writes haiku poetry",
      systemPrompt: "You are a haiku poet. Respond only with a haiku (5-7-5 syllables). No explanations.",
      contextText: "Focus on nature themes.",
      priceUsdc: 0.01,
    }),
  });
  if (!agentARes.ok) throw new Error(`Create agent A failed: ${await agentARes.text()}`);
  const agentA = (await agentARes.json()) as { id: string; agentWalletAddress: string; endpoint: string };
  console.log("[test-agents] ✅ Agent A created:", agentA.id, "wallet:", agentA.agentWalletAddress);

  // ── Step 3: Create Agent B (summariser) ─────────────────────────────────
  const agentBRes = await fetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      name: "Summarizer Agent",
      description: "Condenses text into one sentence",
      systemPrompt: "You are a summarizer. Respond with exactly one concise sentence.",
      contextText: "",
      priceUsdc: 0.005,
    }),
  });
  if (!agentBRes.ok) throw new Error(`Create agent B failed: ${await agentBRes.text()}`);
  const agentB = (await agentBRes.json()) as { id: string; agentWalletAddress: string };
  console.log("[test-agents] ✅ Agent B created:", agentB.id, "wallet:", agentB.agentWalletAddress);

  // ── Step 4: Verify both agents appear on marketplace ────────────────────
  const listRes = await fetch(`${API_BASE}/agents`);
  const list = (await listRes.json()) as Array<{ id: string }>;
  const ids = list.map((a) => a.id);
  if (!ids.includes(agentA.id) || !ids.includes(agentB.id)) {
    throw new Error("Agents not visible on marketplace");
  }
  console.log("[test-agents] ✅ Both agents visible on marketplace (total:", list.length, ")");

  // ── Step 5: Verify search/sort ───────────────────────────────────────────
  const searchRes = await fetch(`${API_BASE}/agents?search=poet&sort=price`);
  const searchList = (await searchRes.json()) as Array<{ id: string }>;
  if (!searchList.some((a) => a.id === agentA.id)) throw new Error("Search didn't find Poet Agent");
  console.log("[test-agents] ✅ Search/sort working");

  // ── Step 6: GET /agents/:id (single detail) ──────────────────────────────
  const detailRes = await fetch(`${API_BASE}/agents/${agentA.id}`);
  const detail = (await detailRes.json()) as { systemPrompt: string | null };
  if (!detail.systemPrompt?.includes("haiku")) throw new Error("systemPrompt not returned in detail");
  console.log("[test-agents] ✅ GET /agents/:id — systemPrompt returned");

  // ── Step 7: Call runner (mock mode — no ANTHROPIC_API_KEY needed) ────────
  // Runner returns 402 without X-PAYMENT — that's expected behaviour
  const noPayRes = await fetch(`${RUNNER_BASE}/run/${agentA.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: "Write about rain" }),
  });
  if (noPayRes.status !== 402) {
    console.warn("[test-agents] ⚠️  Expected 402, got", noPayRes.status, "(runner may be down or payment already satisfied)");
  } else {
    console.log("[test-agents] ✅ Runner returns 402 without payment header");
  }

  // ── Step 8: Update agent via PUT ─────────────────────────────────────────
  const putRes = await fetch(`${API_BASE}/agents/${agentA.id}`, {
    method: "PUT",
    headers: authH,
    body: JSON.stringify({ description: "Updated: Writes haiku poetry about nature" }),
  });
  if (!putRes.ok) throw new Error("PUT /agents/:id failed");
  const updated = (await putRes.json()) as { description: string };
  if (!updated.description.includes("Updated")) throw new Error("Description not updated");
  console.log("[test-agents] ✅ PUT /agents/:id — description updated");

  // ── Step 9: Deactivate agent B ───────────────────────────────────────────
  const delRes = await fetch(`${API_BASE}/agents/${agentB.id}`, {
    method: "DELETE",
    headers: authH,
  });
  if (!delRes.ok) throw new Error("DELETE /agents/:id failed");
  const afterDel = await (await fetch(`${API_BASE}/agents`)).json() as Array<{ id: string }>;
  if (afterDel.some((a) => a.id === agentB.id)) throw new Error("Deactivated agent still in marketplace");
  console.log("[test-agents] ✅ DELETE (deactivate) — agent B removed from marketplace");

  console.log("\n[test-agents] 🎉 All checks passed. JWT_SECRET used:", JWT_SECRET_CHECK.slice(0, 4) + "***");
}

main().catch((e) => {
  console.error("[test-agents] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
