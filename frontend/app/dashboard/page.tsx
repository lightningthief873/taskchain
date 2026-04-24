"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyTasks, priceDisplay, type Task } from "@/lib/tasks";
import { getStoredToken } from "@/lib/auth";

const STATUS_STYLES: Record<string, string> = {
  COMPLETE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  AWAITING_APPROVAL: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  RUNNING: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  AWAITING_FUND: "bg-zinc-700 text-zinc-400 border-zinc-600",
  PENDING: "bg-zinc-700 text-zinc-400 border-zinc-600",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
  DISPUTED: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-zinc-700 text-zinc-400 border-zinc-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{status}</span>
  );
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getStoredToken();

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getMyTasks()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return (
      <div className="text-center py-24 text-zinc-500">
        <p className="mb-3">Connect your wallet to view your dashboard.</p>
        <Link href="/marketplace" className="text-avax hover:underline text-sm">
          Browse the Marketplace →
        </Link>
      </div>
    );
  }

  const total = tasks.length;
  const complete = tasks.filter((t) => t.status === "COMPLETE").length;
  const active = tasks.filter((t) =>
    ["RUNNING", "AWAITING_APPROVAL", "AWAITING_FUND"].includes(t.status),
  ).length;
  const spent = tasks
    .filter((t) => t.status === "COMPLETE" && t.totalCostUsdc)
    .reduce((s, t) => s + (t.totalCostUsdc ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Your task history and activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Tasks", value: total },
          { label: "Completed", value: complete },
          { label: "Active", value: active },
          { label: "Total Spent", value: spent ? priceDisplay(spent) : "—" },
        ].map((s) => (
          <div
            key={s.label}
            className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 text-center"
          >
            <div className="text-2xl font-bold text-avax">{s.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/marketplace"
          className="px-4 py-2 bg-avax text-white text-sm font-medium rounded hover:opacity-90 transition-opacity"
        >
          + New Pipeline
        </Link>
        <Link
          href="/agents/create"
          className="px-4 py-2 border border-zinc-700 text-zinc-300 text-sm rounded hover:border-zinc-500 transition-colors"
        >
          Create Agent
        </Link>
        <Link
          href="/agents/my"
          className="px-4 py-2 border border-zinc-700 text-zinc-300 text-sm rounded hover:border-zinc-500 transition-colors"
        >
          My Agents
        </Link>
        <Link
          href="/token"
          className="px-4 py-2 border border-avax/30 text-avax text-sm rounded hover:bg-avax/10 transition-colors"
        >
          $TASK Token
        </Link>
      </div>

      {/* Recent tasks */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Recent Tasks
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="border border-zinc-800 rounded-lg py-16 text-center text-zinc-600">
            <p>No tasks yet.</p>
            <Link href="/marketplace" className="text-avax hover:underline mt-2 inline-block text-sm">
              Start your first pipeline →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 20).map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 truncate">
                      {(task.inputPayload?.text ?? "Pipeline task").slice(0, 80) || "Pipeline task"}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5 font-mono">
                      {new Date(task.createdAt).toLocaleString()} · {task.steps.length} step
                      {task.steps.length !== 1 ? "s" : ""}
                      {task.totalCostUsdc ? ` · ${priceDisplay(task.totalCostUsdc)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
