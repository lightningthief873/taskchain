"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { getTask, submitReview, priceDisplay, type Task, type TaskStep } from "@/lib/tasks";
import { getStoredToken } from "@/lib/auth";
import { SNOWTRACE } from "@/lib/config";
import { joinTaskRoom, leaveTaskRoom } from "@/lib/socket";
import {
  getBrowserSigner,
  approveUSDC,
  fundEscrow,
  approveEscrowTask,
  disputeEscrowTask,
} from "@/lib/escrow";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";
const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "";

// ── Status helpers ────────────────────────────────────────────────────────────

const LABEL: Record<string, string> = {
  PENDING: "waiting",
  RUNNING: "running",
  COMPLETE: "complete",
  FAILED: "failed",
  AWAITING_APPROVAL: "awaiting your approval",
  DISPUTED: "disputed",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:           "text-zinc-500 border-zinc-700",
  RUNNING:           "text-amber-400 border-amber-500",
  COMPLETE:          "text-emerald-400 border-emerald-500",
  FAILED:            "text-red-400 border-red-500",
  AWAITING_APPROVAL: "text-blue-400 border-blue-500",
  DISPUTED:          "text-orange-400 border-orange-500",
};

const DOT_COLOR: Record<string, string> = {
  PENDING:           "bg-zinc-600",
  RUNNING:           "bg-amber-400 animate-pulse",
  COMPLETE:          "bg-emerald-500",
  FAILED:            "bg-red-500",
  AWAITING_APPROVAL: "bg-blue-400",
  DISPUTED:          "bg-orange-400",
};

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  taskId,
  token,
}: {
  step: TaskStep;
  taskId: string;
  token: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewed, setReviewed] = useState(
    step.reviews.some((r) => r.rating > 0),
  );

  const canReview = token && step.status === "COMPLETE" && !reviewed;

  async function handleReview() {
    if (!rating) return;
    setReviewing(true);
    try {
      await submitReview(taskId, step.id, rating, comment || undefined);
      setReviewed(true);
      toast.success("Review submitted!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
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
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${DOT_COLOR[step.status] ?? "bg-zinc-600"}`}
        />
        <div className="w-px flex-1 bg-zinc-800 mt-1" />
      </div>

      <div className="flex-1 pb-6">
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
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

          {step.stepContext && (
            <p className="text-xs text-zinc-500 italic">"{step.stepContext}"</p>
          )}

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

          {step.paymentTxHash && (
            <a
              href={`${SNOWTRACE}/tx/${step.paymentTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-zinc-600 hover:text-avax flex items-center gap-1"
            >
              💳 {step.paymentTxHash.slice(0, 10)}…{step.paymentTxHash.slice(-6)} ↗
            </a>
          )}

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
            <p className="text-xs text-emerald-500 border-t border-zinc-800 pt-2">
              ✓ Review submitted
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── EscrowPanel — PENDING state ───────────────────────────────────────────────

interface EscrowData {
  taskId32: string;
  escrowContract: string;
  agentAddresses: string[];
  agentAmounts: number[];
  totalCostUsdc: number;
}

function EscrowPanel({
  taskId,
  data,
  token,
  onFunded,
  getEip1193,
}: {
  taskId: string;
  data: EscrowData;
  token: string | null;
  onFunded: (txHash: string) => void;
  getEip1193: () => Promise<ethers.Eip1193Provider>;
}) {
  const [step, setStep] = useState<"idle" | "approving" | "funding" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFund() {
    if (!token) { setError("Connect wallet first"); return; }
    if (!data.escrowContract) {
      onFunded("skip");
      return;
    }
    setError(null);
    setStep("approving");
    try {
      const eip1193 = await getEip1193();
      const signer = await getBrowserSigner(eip1193);
      await approveUSDC(signer, data.escrowContract, BigInt(data.totalCostUsdc));
      setStep("funding");
      const { txHash } = await fundEscrow(
        signer,
        data.escrowContract,
        taskId,
        data.agentAddresses,
        data.agentAmounts,
        data.totalCostUsdc,
      );
      setStep("done");
      toast.success("Escrow funded! Pipeline starting…");
      onFunded(txHash);
    } catch (e) {
      setStep("idle");
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg);
      toast.error(msg);
    }
  }

  const labels = {
    idle: "Fund Escrow & Start",
    approving: "Step 1/2: Approving USDC…",
    funding: "Step 2/2: Funding escrow…",
    done: "Funded!",
  };

  return (
    <div className="border border-zinc-700 rounded-lg p-5 bg-zinc-900/60 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Fund Escrow to Start</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Deposit {priceDisplay(data.totalCostUsdc)} USDC into the escrow contract.
          Funds release to agents only after you approve the output.
        </p>
      </div>

      <div className="text-xs space-y-1 text-zinc-400">
        <div className="flex justify-between">
          <span>Agent costs</span>
          <span>{priceDisplay(data.agentAmounts.reduce((s, a) => s + a, 0))}</span>
        </div>
        <div className="flex justify-between">
          <span>Platform fee (5%)</span>
          <span>{priceDisplay(data.totalCostUsdc - data.agentAmounts.reduce((s, a) => s + a, 0))}</span>
        </div>
        <div className="flex justify-between font-medium text-zinc-200 border-t border-zinc-700 pt-1 mt-1">
          <span>Total</span>
          <span className="text-avax">{priceDisplay(data.totalCostUsdc)}</span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={() => void handleFund()}
        disabled={step !== "idle"}
        className="w-full bg-avax hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded text-sm"
      >
        {labels[step]}
      </button>

      {!data.escrowContract && (
        <p className="text-xs text-zinc-600 text-center">
          Escrow contract not configured — will skip on-chain deposit.
        </p>
      )}
    </div>
  );
}

// ── ApprovalPanel — AWAITING_APPROVAL state ───────────────────────────────────

function ApprovalPanel({
  taskId,
  finalOutput,
  token,
  onApproved,
  onDisputed,
  getEip1193,
}: {
  taskId: string;
  finalOutput: string;
  token: string | null;
  onApproved: () => void;
  onDisputed: () => void;
  getEip1193: () => Promise<ethers.Eip1193Provider>;
}) {
  const [approving, setApproving] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      let approveTxHash: string | undefined;

      // If escrow is configured, sign the on-chain approve tx first
      if (ESCROW_ADDRESS) {
        const eip1193 = await getEip1193();
        const signer = await getBrowserSigner(eip1193);
        const { txHash } = await approveEscrowTask(signer, ESCROW_ADDRESS, taskId);
        approveTxHash = txHash;
      }

      const res = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ approveTxHash }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Payment approved — agents paid!");
      onApproved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Approval failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setApproving(false);
    }
  }

  async function handleDispute() {
    if (!disputeReason.trim()) return;
    setDisputing(true);
    setError(null);
    try {
      let disputeTxHash: string | undefined;

      if (ESCROW_ADDRESS) {
        const eip1193 = await getEip1193();
        const signer = await getBrowserSigner(eip1193);
        const { txHash } = await disputeEscrowTask(
          signer,
          ESCROW_ADDRESS,
          taskId,
          disputeReason,
        );
        disputeTxHash = txHash;
      }

      const res = await fetch(`${API_URL}/tasks/${taskId}/dispute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ reason: disputeReason, disputeTxHash }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Dispute filed. Funds locked for 48 hours.", { icon: "⚠️" });
      setShowDisputeModal(false);
      onDisputed();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dispute failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setDisputing(false);
    }
  }

  return (
    <div className="border border-blue-500/30 rounded-lg p-5 bg-blue-500/5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Pipeline Complete — Review Output</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Approve to release payment to agents, or dispute if the output is unsatisfactory.
        </p>
      </div>

      {/* Final output */}
      <pre className="text-sm text-zinc-300 bg-zinc-900 rounded p-4 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto border border-zinc-800">
        {finalOutput || "No output recorded."}
      </pre>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => void handleApprove()}
          disabled={approving || disputing}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium py-2.5 rounded text-sm"
        >
          {approving ? "Signing…" : "Approve & Pay ✓"}
        </button>
        <button
          onClick={() => setShowDisputeModal(true)}
          disabled={approving || disputing}
          className="flex-1 border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 font-medium py-2.5 rounded text-sm"
        >
          Dispute ✗
        </button>
      </div>

      {/* Dispute modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-zinc-100">Dispute Output</h3>
            <p className="text-xs text-zinc-500">
              Describe why the output is unsatisfactory. Funds will be locked for 48h
              then refunded if unresolved.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="The output was incomplete because…"
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => void handleDispute()}
                disabled={disputing || !disputeReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white py-2 rounded text-sm"
              >
                {disputing ? "Signing…" : "Submit Dispute"}
              </button>
              <button
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 border border-zinc-700 text-zinc-400 hover:text-white py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Success banner ────────────────────────────────────────────────────────────

function SuccessBanner({ txHash }: { txHash?: string | null }) {
  return (
    <div className="border border-emerald-500/30 rounded-lg p-5 bg-emerald-500/5 text-center space-y-2">
      <div className="text-4xl">🎉</div>
      <h3 className="font-semibold text-emerald-400 text-lg">Payment Released!</h3>
      <p className="text-xs text-zinc-400">
        USDC distributed to agent wallets and platform treasury on Fuji.
      </p>
      {txHash && txHash !== "skip" && (
        <a
          href={`${SNOWTRACE}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-mono text-zinc-500 hover:text-avax"
        >
          Tx: {txHash.slice(0, 12)}… ↗
        </a>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface EscrowMeta {
  taskId32: string;
  escrowContract: string;
  agentAddresses: string[];
  agentAmounts: number[];
}

export default function TaskStatusPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const token = getStoredToken();
  const { wallets } = useWallets();

  async function getEip1193(): Promise<ethers.Eip1193Provider> {
    const privyWallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    if (privyWallet) {
      return (await privyWallet.getEthereumProvider()) as ethers.Eip1193Provider;
    }
    const win = typeof window !== "undefined" ? (window as unknown as { ethereum?: ethers.Eip1193Provider }) : {};
    if (win.ethereum) return win.ethereum;
    throw new Error("No wallet provider found. Connect a wallet first.");
  }

  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escrowMeta, setEscrowMeta] = useState<EscrowMeta | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const escrowMetaRef = useRef<EscrowMeta | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      const t = await getTask(taskId);
      setTask(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task not found");
    }
  }, [taskId]);

  // Load escrow metadata from sessionStorage (set by marketplace page when task was created)
  useEffect(() => {
    const stored = sessionStorage.getItem(`escrow:${taskId}`);
    if (stored) {
      const meta = JSON.parse(stored) as EscrowMeta;
      setEscrowMeta(meta);
      escrowMetaRef.current = meta;
    }
  }, [taskId]);

  useEffect(() => {
    void fetchTask();
  }, [fetchTask]);

  // Poll every 3s while RUNNING
  useEffect(() => {
    if (!task || task.status !== "RUNNING") return;
    const timer = setInterval(() => void fetchTask(), 3000);
    return () => clearInterval(timer);
  }, [task, fetchTask]);

  // WebSocket for live step updates
  useEffect(() => {
    const socket = joinTaskRoom(taskId);

    socket.on("task:step:start", ({ stepId }: { stepId: string }) => {
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === stepId ? { ...s, status: "RUNNING" } : s,
          ),
        };
      });
    });

    socket.on("task:step:complete", ({ stepId, output }: { stepId: string; output: string }) => {
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === stepId
              ? { ...s, status: "COMPLETE", outputPayload: { output } }
              : s,
          ),
        };
      });
    });

    socket.on("task:step:failed", ({ stepId }: { stepId: string }) => {
      toast.error("A step failed — check output below.");
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "FAILED",
          steps: prev.steps.map((s) =>
            s.id === stepId ? { ...s, status: "FAILED" } : s,
          ),
        };
      });
    });

    socket.on("task:complete", ({ output }: { output: string }) => {
      toast.success("Pipeline complete! Review the output below.");
      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: "AWAITING_APPROVAL",
              outputPayload: { finalOutput: output },
            }
          : prev,
      );
    });

    socket.on("task:approved", () => {
      toast.success("Payment released to all agents!");
      setTask((prev) => (prev ? { ...prev, status: "COMPLETE" } : prev));
    });

    socket.on("task:disputed", () => {
      toast("Dispute confirmed. Funds locked 48h.", { icon: "⚠️" });
      setTask((prev) => (prev ? { ...prev, status: "DISPUTED" } : prev));
    });

    return () => {
      leaveTaskRoom(taskId);
      socket.off("task:step:start");
      socket.off("task:step:complete");
      socket.off("task:step:failed");
      socket.off("task:complete");
      socket.off("task:approved");
      socket.off("task:disputed");
    };
  }, [taskId]);

  async function handleFunded(fundingTxHash: string) {
    const res = await fetch(`${API_URL}/tasks/${taskId}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({ fundingTxHash }),
    });
    if (res.ok) {
      setTask((prev) => (prev ? { ...prev, status: "RUNNING" } : prev));
    }
  }

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
      <div className="space-y-8 max-w-2xl">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-900 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const totalRaw = task.steps.reduce((s, step) => s + step.agent.priceUsdc, 0);
  const finalOutput =
    task.outputPayload != null && typeof task.outputPayload === "object"
      ? ((task.outputPayload as { finalOutput?: string }).finalOutput ?? "")
      : "";

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

        {task.inputPayload?.text && (
          <p className="text-sm text-zinc-400">
            <span className="text-zinc-600">Input: </span>
            {String(task.inputPayload.text).slice(0, 120)}
            {String(task.inputPayload.text).length > 120 && "…"}
          </p>
        )}

        <div className="flex gap-4 text-xs text-zinc-500">
          <span>{task.steps.length} step{task.steps.length !== 1 ? "s" : ""}</span>
          <span>Est. cost: {priceDisplay(task.totalCostUsdc ?? totalRaw)}</span>
          <span>{new Date(task.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Escrow funding (PENDING) */}
      {task.status === "PENDING" && escrowMeta && (
        <EscrowPanel
          taskId={taskId}
          data={{ ...escrowMeta, totalCostUsdc: task.totalCostUsdc ?? totalRaw }}
          token={token}
          onFunded={(txHash) => void handleFunded(txHash)}
          getEip1193={getEip1193}
        />
      )}

      {/* PENDING without escrow meta — show start without escrow */}
      {task.status === "PENDING" && !escrowMeta && (
        <div className="border border-zinc-700 rounded-lg p-4 space-y-3">
          <p className="text-sm text-zinc-400">Ready to execute pipeline.</p>
          <button
            onClick={() => void handleFunded("skip")}
            className="bg-avax hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded"
          >
            Start Pipeline
          </button>
        </div>
      )}

      {/* Timeline */}
      <div>
        {task.steps.map((step) => (
          <StepCard key={step.id} step={step} taskId={task.id} token={token} />
        ))}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full ${task.status === "COMPLETE" ? "bg-emerald-500" : "bg-zinc-700"}`}
            />
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            {task.status === "COMPLETE"
              ? "✓ Pipeline complete"
              : task.status === "AWAITING_APPROVAL"
                ? "Awaiting your approval"
                : "Awaiting execution"}
          </div>
        </div>
      </div>

      {/* Approval panel (AWAITING_APPROVAL) */}
      {task.status === "AWAITING_APPROVAL" && (
        <ApprovalPanel
          taskId={taskId}
          finalOutput={finalOutput}
          token={token}
          onApproved={() => {
            setTask((prev) => (prev ? { ...prev, status: "COMPLETE" } : prev));
            setApproveTxHash(task.escrowTxHash);
          }}
          onDisputed={() =>
            setTask((prev) => (prev ? { ...prev, status: "DISPUTED" } : prev))
          }
          getEip1193={getEip1193}
        />
      )}

      {/* Success banner (COMPLETE) */}
      {task.status === "COMPLETE" && (
        <SuccessBanner txHash={approveTxHash ?? task.escrowTxHash} />
      )}

      {/* Dispute notice */}
      {task.status === "DISPUTED" && (
        <div className="border border-orange-500/30 rounded-lg p-5 bg-orange-500/5 text-center space-y-2">
          <div className="text-3xl">⚠️</div>
          <h3 className="font-semibold text-orange-400">Task Disputed</h3>
          <p className="text-xs text-zinc-400">
            Funds are locked for 48 hours. If unresolved, you will receive a full refund.
          </p>
        </div>
      )}

      <div className="pt-2">
        <Link href="/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back to Marketplace
        </Link>
      </div>
    </div>
  );
}
