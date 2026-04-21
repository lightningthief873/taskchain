"use client";

import { useState } from "react";
import Link from "next/link";
import StepResult from "@/components/StepResult";
import { authHeaders } from "@/lib/auth";

interface StepResultData {
  agentType: string;
  instruction: string;
  output: unknown;
  paymentTxHash?: string;
}

interface TaskResponse {
  taskId: string;
  description: string;
  steps: StepResultData[];
  finalResult: unknown;
  error?: string;
  details?: string;
}

const EXAMPLE_DESCRIPTION =
  "Analyze this data: [1,2,3,4,5], write a one-paragraph summary, translate it to Spanish";
const EXAMPLE_DATA = "1,2,3,4,5";

export default function HomePage() {
  const [description, setDescription] = useState(EXAMPLE_DESCRIPTION);
  const [dataInput, setDataInput] = useState(EXAMPLE_DATA);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TaskResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setErrorMsg(null);
    setElapsed(null);

    const data = dataInput
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    const body = { description, payload: data.length > 0 ? { data } : {} };
    const start = Date.now();

    try {
      const res = await fetch("/api/task", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as TaskResponse;
      setElapsed(Date.now() - start);

      if (!res.ok || json.error) {
        setErrorMsg(json.details ?? json.error ?? "Unknown error");
      } else {
        setResult(json);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const finalOutput = result?.finalResult as Record<string, unknown> | null;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono px-2 py-1 bg-avax/10 text-avax border border-avax/20 rounded">
            Avalanche Fuji
          </span>
          <span className="text-xs font-mono px-2 py-1 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded">
            x402 payments
          </span>
          <span className="text-xs font-mono px-2 py-1 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded">
            ERC-8004 reputation
          </span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
          Autonomous Task Economy
        </h1>
        <p className="text-zinc-400 mt-2 text-sm max-w-xl">
          Submit a plain-English task. The router decomposes it, hires specialist AI agents via
          on-chain USDC payments, and delivers the composed result — no human approval at any step.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
            Task Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-avax/50 resize-none"
            placeholder="Analyze this data: [1,2,3,4,5], write a one-paragraph summary, translate it to Spanish"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
            Data Array{" "}
            <span className="text-zinc-600 normal-case font-normal">(comma-separated numbers)</span>
          </label>
          <input
            type="text"
            value={dataInput}
            onChange={(e) => setDataInput(e.target.value)}
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-avax/50"
            placeholder="1, 2, 3, 4, 5"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-avax hover:bg-avax-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Pipeline running…
              </>
            ) : (
              "Run Pipeline →"
            )}
          </button>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            View Dashboard →
          </Link>
        </div>

        {loading && (
          <div className="text-xs text-zinc-500 font-mono space-y-1 pt-1">
            <p>⟳ Decomposing task…</p>
            <p>⟳ Selecting agents by reputation…</p>
            <p>⟳ Executing x402 payment pipeline (analyzer → writer → translator)…</p>
          </div>
        )}
      </form>

      {/* Error */}
      {errorMsg && (
        <div className="card p-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm text-red-400 font-semibold">Pipeline failed</p>
          <p className="text-xs text-red-500/80 mt-1 font-mono">{errorMsg}</p>
          <p className="text-xs text-zinc-600 mt-2">
            Make sure all agent servers and the local facilitator are running.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-100">Pipeline Results</h2>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              {elapsed && <span>{(elapsed / 1000).toFixed(1)}s</span>}
              <span className="font-mono">{result.taskId.slice(0, 14)}…</span>
              <span className="badge-success px-2 py-0.5 rounded text-xs">
                0.03 USDC total
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {result.steps.map((step, i) => (
              <StepResult
                key={i}
                index={i + 1}
                agentType={step.agentType}
                instruction={step.instruction}
                output={step.output}
                paymentTxHash={step.paymentTxHash}
              />
            ))}
          </div>

          {typeof finalOutput?.translatedText === "string" && (
            <div className="card p-5 border-emerald-500/20 bg-emerald-500/5">
              <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">
                Final Result — Spanish
              </p>
              <p className="text-zinc-100 leading-relaxed">
                {finalOutput.translatedText as string}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
