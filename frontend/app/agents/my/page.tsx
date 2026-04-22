"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAgents, deactivateAgent, updateAgent, type AgentSummary } from "@/lib/agents";
import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

function priceDisplay(raw: number) {
  return (raw / 1_000_000).toFixed(6).replace(/\.?0+$/, "") + " USDC";
}

function truncate(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const token = getStoredToken();

  async function load() {
    if (!token) { setLoading(false); return; }
    try {
      // Fetch all agents then filter to current user's
      const meRes = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) throw new Error("Not authenticated");
      const me = (await meRes.json()) as { id: string };

      const all = await listAgents();
      setAgents(all.filter((a) => a.owner.id === me.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this agent? It will no longer appear on the marketplace.")) return;
    await deactivateAgent(id).catch((e: unknown) => alert(String(e)));
    await load();
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    try {
      await updateAgent(id, {
        description: editDesc || undefined,
        priceUsdc: editPrice ? parseFloat(editPrice) : undefined,
      });
      setEditId(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center py-20 text-zinc-500">
        Connect your wallet to manage your agents.
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-20 text-zinc-500">Loading…</div>;
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">My Agents</h1>
          <p className="text-zinc-500 text-sm mt-1">{agents.length} agent{agents.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/agents/create"
          className="bg-avax hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded"
        >
          + New Agent
        </Link>
      </div>

      {agents.length === 0 && (
        <div className="text-center py-20 border border-zinc-800 rounded-lg text-zinc-500">
          <p>You haven&apos;t created any agents yet.</p>
          <Link href="/agents/create" className="text-avax hover:underline mt-2 inline-block text-sm">
            Create your first agent →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-100 truncate">{agent.name}</span>
                  {!agent.isActive && (
                    <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                {editId === agent.id ? (
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-avax"
                  />
                ) : (
                  <p className="text-zinc-500 text-sm mt-0.5 truncate">{agent.description ?? "—"}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editId === agent.id ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(agent.id)}
                      disabled={saving}
                      className="text-xs bg-avax text-white px-3 py-1 rounded hover:opacity-80 disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="text-xs border border-zinc-700 text-zinc-400 px-3 py-1 rounded hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditId(agent.id); setEditDesc(agent.description ?? ""); setEditPrice(String(agent.priceUsdc / 1_000_000)); }}
                      className="text-xs border border-zinc-700 text-zinc-400 px-3 py-1 rounded hover:text-white"
                    >
                      Edit
                    </button>
                    {agent.isActive && (
                      <button
                        onClick={() => handleDeactivate(agent.id)}
                        className="text-xs border border-red-900 text-red-400 px-3 py-1 rounded hover:bg-red-900/20"
                      >
                        Deactivate
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-zinc-600 mb-0.5">Price</div>
                {editId === agent.id ? (
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    min="0.000001"
                    step="0.001"
                    className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-200 focus:outline-none focus:border-avax"
                  />
                ) : (
                  <div className="text-avax font-medium">{priceDisplay(agent.priceUsdc)}</div>
                )}
              </div>
              <div>
                <div className="text-zinc-600 mb-0.5">Reputation</div>
                <div className="text-zinc-300">{agent.reputationScore}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-0.5">Wallet</div>
                <div className="font-mono text-zinc-400">
                  {agent.agentWalletAddress ? truncate(agent.agentWalletAddress) : "—"}
                </div>
              </div>
              <div>
                <div className="text-zinc-600 mb-0.5">Created</div>
                <div className="text-zinc-400">{new Date(agent.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="text-xs text-zinc-700 font-mono truncate">
              {agent.endpoint}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
