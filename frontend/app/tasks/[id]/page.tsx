"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getTask, submitReview, priceDisplay, type Task, type TaskStep } from "@/lib/tasks";
import { getStoredToken } from "@/lib/auth";
import { SNOWTRACE } from "@/lib/config";

const LABEL: Record<string, string> = {
  PENDING: "waiting",
  RUNNING: "running",
  COMPLETE: "complete",
  FAILED: "failed",
  AWAITING_APPROVAL: "awaiting approval",
  DISPUTED: "disputed",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-zinc-500 border-zinc-700",
  RUNNING: "text-amber-400 border-amber-500",
  COMPLETE: "text-emerald-400 border-emerald-500",
  FAILED: "text-red-400 border-red-500",
  AWAITING_APPROVAL: "text-blue-400 border-blue-500",
  DISPUTED: "text-orange-400 border-orange-500",
};

const DOT_COLOR: Record<string, string> = {
  PENDING: "bg-zinc-600",
  RUNNING: "bg-amber-400 animate-pulse",
  COMPLETE: "bg-emerald-500",
  FAILED: "bg-red-500",
  AWAITING_APPROVAL: "bg-blue-400",
  DISPUTED: "bg-orange-400",
};

function StepCard({ step, taskId, token }: { step: TaskStep; taskId: string; token: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewed, setReviewed] = useState(step.reviews.some((r) => r.rating > 0));

  const canReview = token && step.status === "COMPLETE" && !reviewed;

  async function handleReview() {
    if (!rating) return;
    setReviewing(true);
    try {
      await submitReview(taskId, step.id, rating, comment || undefined);
      setReviewed(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  }

  const output =
    step.outputPayload != null
      ? typeof step.outputPayload === "string"
        ? step.outputPayload
        : JSON.stringify(step.outputPayload, null, 2)
      : null;

  return (
    <div className="flex gap-4">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${DOT_COLOR[step.status] ?? "bg-zinc-600"}`}
        />
        <div className="w-px flex-1 bg-zinc-800 mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-6">
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 space-y-3">
          {/* Step header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                {step.agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-zinc-100 text-sm">{step.agent.name}</div>
                <div className="text-xs text-zinc-500">
                  Step {step.stepIndex + 1} · {priceDisplay(step.agent.priceUsdc)}
                </div>
              </div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[step.status] ?? "text-zinc-500 border-zinc-700"}`}
            >
              {LABEL[step.status] ?? step.status}
            </span>
          </div>

          {/* Step context */}
          {step.stepContext && (
            <p className="text-xs text-zinc-500 italic">"{step.stepContext}"</p>
          )}

          {/* Output preview */}
          {output && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                {expanded ? "▲ Hide output" : "▼ Show output"}
              </button>
              {expanded && (
                <pre className="mt-2 text-xs text-zinc-400 bg-zinc-800/60 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {output}
                </pre>
              )}
            </div>
          )}

          {/* Payment tx */}
          {step.paymentTxHash && (
            <a
              href={`${SNOWTRACE}/tx/${step.paymentTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-zinc-600 hover:text-avax flex items-center gap-1"
            >
              <span>💳</span>
              <span>
                {step.paymentTxHash.slice(0, 10)}…{step.paymentTxHash.slice(-6)}
              </span>
              <span>↗</span>
            </a>
          )}

          {/* Review widget */}
          {canReview && (
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <div className="text-xs text-zinc-500">Rate this agent:</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={`text-xl leading-none ${n <= rating ? "text-yellow-400" : "text-zinc-700 hover:text-zinc-500"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment (optional)…"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none"
                  />
                  <button
                    onClick={() => void handleReview()}
                    disabled={reviewing}
                    className="text-xs bg-avax/10 border border-avax/30 text-avax px-3 py-1 rounded hover:bg-avax hover:text-white disabled:opacity-40"
                  >
                    {reviewing ? "Saving…" : "Submit Review"}
                  </button>
                </>
              )}
            </div>
          )}

          {reviewed && (
            <p className="text-xs text-emerald-500 border-t border-zinc-800 pt-2">✓ Review submitted</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskStatusPage() {
  const { id } = useParams<{ id: string }>();
  const token = getStoredToken();

  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      const t = await getTask(id);
      setTask(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task not found");
    }
  }, [id]);

  useEffect(() => {
    void fetchTask();
  }, [fetchTask]);

  // Poll every 3s while task is running
  useEffect(() => {
    if (!task || task.status !== "RUNNING") return;
    const timer = setInterval(() => void fetchTask(), 3000);
    return () => clearInterval(timer);
  }, [task, fetchTask]);

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error}</p>
        <Link href="/marketplace" className="text-avax hover:underline mt-4 inline-block text-sm">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-8">
        <div className="h-6 w-40 bg-zinc-800 rounded animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-900 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const totalRaw = task.steps.reduce((s, step) => s + step.agent.priceUsdc, 0);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100">Task</h1>
          <span
            className={`text-xs px-3 py-1 rounded-full border font-medium ${STATUS_COLOR[task.status] ?? "text-zinc-500 border-zinc-700"}`}
          >
            {LABEL[task.status] ?? task.status}
          </span>
        </div>
        <p className="font-mono text-xs text-zinc-600 break-all">{task.id}</p>

        <div className="flex gap-6 text-sm mt-2">
          {task.inputPayload?.text && (
            <div>
              <span className="text-zinc-600">Input: </span>
              <span className="text-zinc-300">
                {String(task.inputPayload.text).slice(0, 100)}
                {String(task.inputPayload.text).length > 100 && "…"}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-6 text-xs text-zinc-500 pt-1">
          <span>{task.steps.length} steps</span>
          <span>Est. cost: {priceDisplay(task.totalCostUsdc ?? totalRaw)}</span>
          <span>{new Date(task.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Timeline */}
      <div>
        {task.steps.map((step) => (
          <StepCard key={step.id} step={step} taskId={task.id} token={token} />
        ))}
        {/* End dot */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full ${task.status === "COMPLETE" ? "bg-emerald-500" : "bg-zinc-700"}`}
            />
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            {task.status === "COMPLETE" ? "✓ Pipeline complete" : "Awaiting execution"}
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Link href="/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back to Marketplace
        </Link>
      </div>
    </div>
  );
}
