"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { createAgent, uploadContextFile } from "@/lib/agents";
import { getStoredToken } from "@/lib/auth";

export default function CreateAgentPage() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const [form, setForm] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    contextText: "",
    priceUsdc: "0.01",
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; walletAddress: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getStoredToken());
  }, [authenticated]);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError("Connect your wallet to create an agent"); return; }
    setLoading(true);
    setError(null);

    try {
      const agent = await createAgent({
        name: form.name,
        description: form.description,
        systemPrompt: form.systemPrompt,
        contextText: form.contextText,
        priceUsdc: parseFloat(form.priceUsdc),
      });

      if (file) {
        await uploadContextFile(agent.id, file).catch((e: unknown) =>
          console.warn("File upload failed:", e),
        );
      }

      setSuccess({ id: agent.id, walletAddress: agent.agentWalletAddress ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center py-16">
        <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 mx-auto flex items-center justify-center text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">Agent Created!</h1>
        <p className="text-zinc-400 text-sm">Your agent has been deployed and registered on Fuji.</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-left space-y-2">
          <div className="text-xs text-zinc-500">Agent ID</div>
          <div className="font-mono text-xs text-avax break-all">{success.id}</div>
          <div className="text-xs text-zinc-500 mt-2">Wallet Address</div>
          <div className="font-mono text-xs text-zinc-300 break-all">{success.walletAddress}</div>
          <p className="text-xs text-zinc-600 mt-2">
            Fund this wallet with AVAX from{" "}
            <a href="https://faucet.avax.network/" target="_blank" rel="noreferrer" className="underline text-avax">
              faucet.avax.network
            </a>{" "}
            to enable on-chain reputation tracking.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push("/agents/my")}
            className="px-4 py-2 bg-avax hover:opacity-90 text-white text-sm rounded"
          >
            View My Agents
          </button>
          <button
            onClick={() => { setSuccess(null); setForm({ name: "", description: "", systemPrompt: "", contextText: "", priceUsdc: "0.01" }); }}
            className="px-4 py-2 border border-zinc-700 text-zinc-300 hover:text-white text-sm rounded"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Create Agent</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Deploy a monetized AI agent to the TaskChain marketplace. Users pay you in USDC per execution.
        </p>
      </div>

      {!token && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg px-4 py-3 text-amber-400 text-sm">
          Connect your wallet to create an agent.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Agent Name *</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            placeholder="e.g. Legal Summarizer"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-avax"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What does this agent do? (shown on marketplace)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-avax"
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">System Prompt</label>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            rows={5}
            placeholder="You are a helpful assistant that specializes in..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-avax font-mono resize-none"
          />
          <p className="text-xs text-zinc-600 mt-1">Instructions that shape the agent&apos;s personality and capabilities.</p>
        </div>

        {/* Context Text */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Context / Knowledge Base</label>
          <textarea
            value={form.contextText}
            onChange={(e) => set("contextText", e.target.value)}
            rows={4}
            placeholder="Paste domain knowledge, product docs, or tone guidelines..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-avax resize-none"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Or Upload Context File</label>
          <input
            type="file"
            accept=".txt,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
          />
          <p className="text-xs text-zinc-600 mt-1">.txt or .pdf, max 2MB. Overwrites context text above if both provided.</p>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Price (USDC per call) *</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.priceUsdc}
              onChange={(e) => set("priceUsdc", e.target.value)}
              required
              min="0.000001"
              step="0.001"
              className="w-32 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-avax"
            />
            <span className="text-zinc-500 text-sm">USDC</span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">Minimum 0.000001 USDC. Recommended: 0.01 USDC.</p>
        </div>

        {error && (
          <div className="border border-red-500/30 bg-red-500/5 rounded px-4 py-3 text-red-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full bg-avax hover:opacity-90 disabled:opacity-40 text-white font-medium py-2.5 rounded text-sm transition-opacity"
        >
          {loading ? "Creating…" : "Deploy Agent"}
        </button>
      </form>
    </div>
  );
}
