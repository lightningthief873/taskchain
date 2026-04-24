"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { listAgents, type AgentSummary } from "@/lib/agents";
import { createTask, priceDisplay, type PipelineEntry } from "@/lib/tasks";
import PipelineComposer from "@/components/PipelineComposer";
import AgentDetailModal from "@/components/AgentDetailModal";
import { getStoredToken } from "@/lib/auth";

// ── Inline marketplace card ──────────────────────────────────────────────────

interface CardProps {
  agent: AgentSummary;
  inPipeline: boolean;
  onAdd: () => void;
  onViewDetail: () => void;
}

function MarketplaceCard({ agent, inPipeline, onAdd, onViewDetail }: CardProps) {
  const scoreColor =
    agent.reputationScore >= 75
      ? "text-emerald-400"
      : agent.reputationScore >= 40
        ? "text-yellow-400"
        : "text-zinc-500";

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 hover:border-zinc-700 transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={onViewDetail}
          className="text-left flex-1 min-w-0 group"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-100 group-hover:text-avax transition-colors truncate">
              {agent.name}
            </span>
            {agent.isVerified && (
              <span
                title="Verified — owner staked 1000+ TASK"
                className="text-xs bg-avax/15 text-avax border border-avax/30 rounded px-1.5 py-0.5 shrink-0 font-medium"
              >
                ✓ Verified
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
            {agent.description ?? "No description"}
          </p>
        </button>
        <div className="text-sm font-semibold text-avax shrink-0">
          {priceDisplay(agent.priceUsdc)}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-zinc-500">
          <span className={scoreColor}>
            ★ {agent.reputationScore}
          </span>
          <span>
            by {agent.owner.username ?? agent.owner.walletAddress.slice(0, 6) + "…"}
          </span>
        </div>
        <button
          onClick={onAdd}
          disabled={inPipeline}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            inPipeline
              ? "bg-zinc-800 text-zinc-500 cursor-default"
              : "bg-avax/10 border border-avax/30 text-avax hover:bg-avax hover:text-white"
          }`}
        >
          {inPipeline ? "Added ✓" : "+ Pipeline"}
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price ↑" },
  { value: "reputation", label: "Reputation ↓" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

export default function MarketplacePage() {
  const router = useRouter();
  const token = getStoredToken();

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentMap, setAgentMap] = useState<Map<string, AgentSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("newest");
  const [maxPriceUsdc, setMaxPriceUsdc] = useState(10);

  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAgents({ sort, search: search.trim() || undefined });
      setAgents(data);
      setAgentMap(new Map(data.map((a) => [a.id, a])));
    } finally {
      setLoading(false);
    }
  }, [sort, search]);

  // Debounce re-fetch when search/sort changes
  useEffect(() => {
    const timer = setTimeout(() => void fetchAgents(), 300);
    return () => clearTimeout(timer);
  }, [fetchAgents]);

  // Client-side max-price filter
  const maxPriceRaw = Math.round(maxPriceUsdc * 1_000_000);
  const displayed = agents.filter((a) => a.priceUsdc <= maxPriceRaw);

  // Pipeline operations
  function addToPipeline(agentId: string) {
    setPipeline((p) => [...p, { agentId, stepContext: "" }]);
  }

  function removeFromPipeline(index: number) {
    setPipeline((p) => p.filter((_, i) => i !== index));
  }

  function movePipeline(from: number, to: number) {
    setPipeline((p) => {
      const next = [...p];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function updateContext(index: number, text: string) {
    setPipeline((p) => p.map((item, i) => (i === index ? { ...item, stepContext: text } : item)));
  }

  async function handleRun(inputText: string) {
    if (!token) { toast.error("Connect your wallet first."); return; }
    if (pipeline.length === 0) { toast.error("Add at least one agent to the pipeline."); return; }
    setRunning(true);
    try {
      const result = await toast.promise(
        createTask({ pipeline, inputPayload: { text: inputText } }),
        { loading: "Creating pipeline…", success: "Pipeline created!", error: (e) => e.message },
      );
      sessionStorage.setItem(
        `escrow:${result.taskId}`,
        JSON.stringify({
          taskId32: result.taskId32,
          escrowContract: result.escrowContract,
          agentAddresses: result.agentAddresses,
          agentAmounts: result.agentAmounts,
        }),
      );
      router.push(`/tasks/${result.taskId}`);
    } catch {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Marketplace</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Browse agents, build a pipeline, and run a multi-step task.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Filters sidebar ── */}
        <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-24 self-start space-y-5">
          {/* Search */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Agent name or description…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-avax"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Sort by</label>
            <div className="space-y-1">
              {SORTS.map((s) => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="sort"
                    value={s.value}
                    checked={sort === s.value}
                    onChange={() => setSort(s.value)}
                    className="accent-avax"
                  />
                  <span
                    className={`text-sm ${sort === s.value ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"}`}
                  >
                    {s.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              Max price: <span className="text-zinc-300">{maxPriceUsdc} USDC</span>
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={maxPriceUsdc}
              onChange={(e) => setMaxPriceUsdc(parseFloat(e.target.value))}
              className="w-full accent-avax"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
              <span>0</span>
              <span>10 USDC</span>
            </div>
          </div>
        </aside>

        {/* ── Agent grid ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-zinc-500">
              {loading ? "Loading…" : `${displayed.length} agent${displayed.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 rounded-lg bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="border border-zinc-800 rounded-lg py-20 text-center text-zinc-600">
              No agents match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayed.map((agent) => (
                <MarketplaceCard
                  key={agent.id}
                  agent={agent}
                  inPipeline={pipeline.some((p) => p.agentId === agent.id)}
                  onAdd={() => addToPipeline(agent.id)}
                  onViewDetail={() => setDetailAgentId(agent.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Pipeline composer ── */}
        <PipelineComposer
          pipeline={pipeline}
          agentMap={agentMap}
          onRemove={removeFromPipeline}
          onMove={movePipeline}
          onContextChange={updateContext}
          onRun={handleRun}
          running={running}
        />
      </div>

      {/* Agent detail modal */}
      {detailAgentId && (
        <AgentDetailModal
          agentId={detailAgentId}
          onClose={() => setDetailAgentId(null)}
          onAddToPipeline={() => addToPipeline(detailAgentId)}
          inPipeline={pipeline.some((p) => p.agentId === detailAgentId)}
        />
      )}
    </div>
  );
}
