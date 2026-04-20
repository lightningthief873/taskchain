"use client";

import AgentCard from "@/components/AgentCard";
import PaymentFeed from "@/components/PaymentFeed";
import { AGENTS, REGISTRY_ADDRESS, SNOWTRACE } from "@/lib/config";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Live agent reputation and on-chain payment events from Avalanche Fuji.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <a
            href={`${SNOWTRACE}/address/${REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-zinc-600 hover:text-avax transition-colors"
          >
            AgentRegistry: {REGISTRY_ADDRESS.slice(0, 10)}…{REGISTRY_ADDRESS.slice(-6)} ↗
          </a>
        </div>
      </div>

      {/* Agent Grid */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Registered Agents
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(AGENTS).map(([key, agent]) => (
            <AgentCard
              key={key}
              name={agent.name}
              address={agent.address}
              description={agent.description}
              price={agent.price}
            />
          ))}
        </div>
      </section>

      {/* Live Event Feed */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          On-Chain Events
        </h2>
        <PaymentFeed />
      </section>

      {/* Legend */}
      <section className="card p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          How It Works
        </h3>
        <ol className="space-y-2 text-xs text-zinc-500">
          <li className="flex gap-2">
            <span className="text-avax font-bold shrink-0">1.</span>
            Router receives task → Anthropic decomposes it into ordered subtasks
          </li>
          <li className="flex gap-2">
            <span className="text-avax font-bold shrink-0">2.</span>
            Selector queries AgentRegistry on-chain, picks highest reputation agent per type
          </li>
          <li className="flex gap-2">
            <span className="text-avax font-bold shrink-0">3.</span>
            Router calls each agent — gets a 402 response, signs EIP-3009 USDC transfer, retries
          </li>
          <li className="flex gap-2">
            <span className="text-avax font-bold shrink-0">4.</span>
            Local facilitator verifies signature and executes on-chain USDC transfer via Fuji
          </li>
          <li className="flex gap-2">
            <span className="text-avax font-bold shrink-0">5.</span>
            Agent processes task, calls AgentRegistry.recordCompletion() — reputation updated
          </li>
        </ol>
      </section>
    </div>
  );
}
