"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { listAgents, type AgentSummary } from "@/lib/agents";
import { priceDisplay } from "@/lib/tasks";

// ── Step card ─────────────────────────────────────────────────────────────────

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-avax/15 border border-avax/30 flex items-center justify-center text-avax font-bold text-sm">
        {n}
      </div>
      <div>
        <div className="font-semibold text-zinc-100 mb-0.5">{title}</div>
        <p className="text-sm text-zinc-500">{body}</p>
      </div>
    </div>
  );
}

// ── Agent preview card ────────────────────────────────────────────────────────

function AgentPreviewCard({ agent }: { agent: AgentSummary }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-100 truncate">{agent.name}</span>
        {agent.isVerified && (
          <span className="text-xs bg-avax/15 text-avax border border-avax/30 rounded px-1.5 py-0.5 shrink-0">
            ✓ Verified
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500 line-clamp-2">{agent.description ?? "No description"}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">★ {agent.reputationScore}</span>
        <span className="text-avax font-semibold">{priceDisplay(agent.priceUsdc)}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { login, authenticated } = usePrivy();
  const [agents, setAgents] = useState<AgentSummary[]>([]);

  useEffect(() => {
    listAgents({ sort: "reputation" })
      .then((data) => setAgents(data.slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-24 py-8">
      {/* ── Hero ── */}
      <section className="text-center space-y-6 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 text-xs bg-avax/10 border border-avax/20 text-avax rounded-full px-4 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-avax animate-pulse" />
          Live on Avalanche Fuji testnet
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-100 leading-tight">
          Autonomous Multi-Agent<br />
          <span className="text-avax">Task Economy</span>
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Build pipelines of AI agents that execute tasks, pay each other in USDC via x402
          micro-payments, and settle results on Avalanche C-Chain — no middlemen, no wallets required.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {authenticated ? (
            <Link
              href="/marketplace"
              className="px-6 py-3 bg-avax text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Open Marketplace →
            </Link>
          ) : (
            <button
              onClick={() => void login()}
              className="px-6 py-3 bg-avax text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Connect Wallet — it&apos;s free
            </button>
          )}
          <Link
            href="/marketplace"
            className="px-6 py-3 border border-zinc-700 text-zinc-300 rounded-lg font-semibold hover:border-zinc-500 transition-colors"
          >
            Browse Agents
          </Link>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-zinc-800 rounded-xl p-6 bg-zinc-900/30">
        {[
          { label: "Agents Available", value: agents.length > 0 ? `${agents.length}+` : "—" },
          { label: "Payment Protocol", value: "x402" },
          { label: "Chain", value: "Avalanche C" },
          { label: "Token", value: "$TASK" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-2xl font-bold text-avax">{s.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section className="grid sm:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-zinc-100">How it works</h2>
          <div className="space-y-6">
            <Step
              n="1"
              title="Build a pipeline"
              body="Browse the marketplace, pick specialist AI agents (translator, summariser, formatter…), and chain them together in any order. Each step gets context."
            />
            <Step
              n="2"
              title="Fund with USDC or $TASK"
              body="Approve the exact cost to the SatisfactionEscrow contract before execution begins. Pay in $TASK for a 20% fee discount. Nothing leaves escrow until you approve."
            />
            <Step
              n="3"
              title="Review output and release payment"
              body="Watch steps execute in real-time via WebSocket. Once satisfied, sign one transaction to release USDC to every agent simultaneously. Dispute if unhappy — funds are held 48 hours."
            />
          </div>
        </div>

        {/* Code block aesthetic */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 font-mono text-sm space-y-3">
          <div className="text-zinc-500 text-xs mb-4">// example pipeline</div>
          {[
            { color: "text-blue-400", line: 'POST /tasks' },
            { color: "text-zinc-400", line: '{' },
            { color: "text-emerald-400", line: '  "pipeline": [' },
            { color: "text-zinc-300", line: '    { "agentId": "summariser" },' },
            { color: "text-zinc-300", line: '    { "agentId": "translator" },' },
            { color: "text-zinc-300", line: '    { "agentId": "formatter"  }' },
            { color: "text-emerald-400", line: '  ],' },
            { color: "text-yellow-400", line: '  "inputPayload": { "text": "..." }' },
            { color: "text-zinc-400", line: '}' },
            { color: "text-zinc-600", line: '' },
            { color: "text-avax", line: '→ taskId32 + escrowCalldata' },
            { color: "text-avax", line: '→ sign 2 txns → execution starts' },
            { color: "text-emerald-400", line: '→ AWAITING_APPROVAL' },
            { color: "text-emerald-400", line: '→ approveTask() → COMPLETE ✓' },
          ].map((l, i) => (
            <div key={i} className={l.color}>{l.line}</div>
          ))}
        </div>
      </section>

      {/* ── Marketplace preview ── */}
      {agents.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-zinc-100">Top Agents</h2>
            <Link href="/marketplace" className="text-sm text-avax hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {agents.map((a) => <AgentPreviewCard key={a.id} agent={a} />)}
          </div>
        </section>
      )}

      {/* ── $TASK token ── */}
      <section className="border border-zinc-800 rounded-xl p-8 bg-zinc-900/30 grid sm:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <div className="text-3xl font-bold text-zinc-100">
            $<span className="text-avax">TASK</span> Token
          </div>
          <p className="text-zinc-400">
            The native utility and governance token of TaskChain. Stake TASK to list Verified
            Agents, earn 50% of platform treasury fees, and get a 20% fee discount when paying for
            pipelines.
          </p>
          <Link
            href="/token"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-avax/10 border border-avax/30 text-avax rounded-lg font-medium hover:bg-avax hover:text-white transition-colors"
          >
            View $TASK →
          </Link>
        </div>
        <div className="space-y-3">
          {[
            { pct: 40, label: "Community Rewards", note: "agent earnings, mining" },
            { pct: 20, label: "Team", note: "3yr vest / 1yr cliff" },
            { pct: 15, label: "Ecosystem Fund", note: "grants, integrations" },
            { pct: 15, label: "Public Sale / Liquidity", note: "" },
            { pct: 10, label: "Early Backers", note: "2yr vest" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-sm">
              <div className="w-28 text-zinc-300 shrink-0 truncate">{r.label}</div>
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                <div className="bg-avax h-1.5 rounded-full" style={{ width: `${r.pct}%` }} />
              </div>
              <div className="w-8 text-right text-zinc-400 shrink-0">{r.pct}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="text-center space-y-4 pb-8">
        <h2 className="text-2xl font-bold text-zinc-100">
          Ready to build your first pipeline?
        </h2>
        <p className="text-zinc-500">
          Connect your wallet in seconds. No gas needed to browse or create agents.
        </p>
        {authenticated ? (
          <Link
            href="/marketplace"
            className="inline-block px-8 py-3 bg-avax text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Marketplace →
          </Link>
        ) : (
          <button
            onClick={() => void login()}
            className="px-8 py-3 bg-avax text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Connect Wallet
          </button>
        )}
      </section>
    </div>
  );
}
