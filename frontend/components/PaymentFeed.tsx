"use client";

import { useEffect, useState } from "react";
import { fetchRecentEvents, type TaskCompletedEvent } from "@/lib/contract";
import { AGENTS, SNOWTRACE } from "@/lib/config";

function agentName(address: string): string {
  const lower = address.toLowerCase();
  for (const [, info] of Object.entries(AGENTS)) {
    if (info.address.toLowerCase() === lower) return info.name;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function EventRow({ event }: { event: TaskCompletedEvent }) {
  const name = agentName(event.agent);
  const taskShort = `${event.taskId.slice(0, 10)}…`;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0 transition-colors ${
        event.success ? "hover:bg-emerald-500/5" : "hover:bg-red-500/5"
      }`}
    >
      <span
        className={`mt-0.5 text-base leading-none ${
          event.success ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {event.success ? "✓" : "✗"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-zinc-200 text-sm uppercase">{name}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              event.success ? "badge-success" : "badge-error"
            }`}
          >
            {event.success ? "success" : "failed"}
          </span>
          <span className="text-xs text-zinc-600">block {event.blockNumber}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="font-mono text-xs text-zinc-500">{taskShort}</span>
          <a
            href={`${SNOWTRACE}/tx/${event.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-600 hover:text-avax transition-colors font-mono"
          >
            {event.txHash.slice(0, 14)}… ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFeed() {
  const [events, setEvents] = useState<TaskCompletedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastBlock, setLastBlock] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const evts = await fetchRecentEvents(-500);
        if (!cancelled) {
          setEvents(evts);
          setLastBlock(evts[0]?.blockNumber ?? null);
          setLoading(false);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "RPC error");
          setLoading(false);
        }
      }
    }

    poll();
    const id = setInterval(poll, 6_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="font-semibold text-zinc-100 text-sm">Live Payment Feed</h2>
        <div className="flex items-center gap-2">
          {lastBlock && (
            <span className="text-xs text-zinc-600 font-mono">block {lastBlock}</span>
          )}
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            polling
          </span>
        </div>
      </div>

      {loading && (
        <div className="px-4 py-8 text-center text-zinc-600 text-sm">
          Fetching on-chain events…
        </div>
      )}

      {error && !loading && (
        <div className="px-4 py-6 text-center text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="px-4 py-8 text-center text-zinc-600 text-sm">
          No events yet. Run a task to see payments here.
        </div>
      )}

      {events.slice(0, 20).map((evt, i) => (
        <EventRow key={`${evt.txHash}-${i}`} event={evt} />
      ))}
    </div>
  );
}
