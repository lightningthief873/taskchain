"use client";

import { useEffect, useState } from "react";
import { fetchReputation, type Reputation } from "@/lib/contract";
import { SNOWTRACE } from "@/lib/config";

interface Props {
  name: string;
  address: string;
  description: string;
  price: string;
  active?: boolean;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function AgentCard({ name, address, description, price, active }: Props) {
  const [rep, setRep] = useState<Reputation | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetchReputation(address);
        if (!cancelled) { setRep(r); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [address]);

  const score = rep ? Number(rep.score) : null;
  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div
      className={`card p-4 flex flex-col gap-3 transition-all duration-200 ${
        active ? "ring-1 ring-avax/60" : "hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-100 uppercase tracking-wide text-sm">
              {name}
            </span>
            {active && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded badge-success">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                working
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        </div>
        <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
          {price}
        </span>
      </div>

      <div>
        {score !== null ? (
          <>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">Reputation</span>
              <span
                className={
                  score >= 75
                    ? "text-emerald-400"
                    : score >= 40
                    ? "text-yellow-400"
                    : "text-red-400"
                }
              >
                {score}/100
              </span>
            </div>
            <ScoreBar score={score} />
            <div className="flex gap-3 mt-1.5 text-xs text-zinc-500">
              <span>✓ {rep!.successes.toString()}</span>
              <span>✗ {rep!.failures.toString()}</span>
            </div>
          </>
        ) : error ? (
          <p className="text-xs text-zinc-600">RPC unreachable</p>
        ) : (
          <div className="h-1.5 bg-zinc-800 rounded-full animate-pulse" />
        )}
      </div>

      <a
        href={`${SNOWTRACE}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        {truncated} ↗
      </a>
    </div>
  );
}
