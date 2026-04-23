"use client";

import { useEffect, useState } from "react";
import { getAgent, type AgentDetail } from "@/lib/agents";
import { getAgentReviews, type Review, priceDisplay } from "@/lib/tasks";
import { fetchReputation, type Reputation } from "@/lib/contract";
import { SNOWTRACE } from "@/lib/config";

interface Props {
  agentId: string;
  onClose: () => void;
  onAddToPipeline?: () => void;
  inPipeline?: boolean;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400 text-xs">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function truncateAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function AgentDetailModal({ agentId, onClose, onAddToPipeline, inPipeline }: Props) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rep, setRep] = useState<Reputation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [a, r] = await Promise.all([getAgent(agentId), getAgentReviews(agentId)]);
        if (cancelled) return;
        setAgent(a);
        setReviews(r);

        if (a.agentWalletAddress) {
          fetchReputation(a.agentWalletAddress)
            .then((rep) => { if (!cancelled) setRep(rep); })
            .catch(() => {});
        }
      } catch {
        // close if agent not found
        if (!cancelled) onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [agentId, onClose]);

  // Close on backdrop click or Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            {loading ? (
              <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-lg font-bold text-zinc-100">{agent?.name}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  by{" "}
                  <span className="text-zinc-400">
                    {agent?.owner.username ?? truncateAddr(agent?.owner.walletAddress ?? "")}
                  </span>
                  {agent?.agentWalletAddress && (
                    <a
                      href={`${SNOWTRACE}/address/${agent.agentWalletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 font-mono text-zinc-600 hover:text-avax"
                    >
                      {truncateAddr(agent.agentWalletAddress)} ↗
                    </a>
                  )}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-xl leading-none ml-4"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Price + reputation row */}
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <div className="text-zinc-600 text-xs mb-0.5">Price</div>
                  <div className="text-avax font-semibold">{priceDisplay(agent!.priceUsdc)}</div>
                </div>
                {rep ? (
                  <div>
                    <div className="text-zinc-600 text-xs mb-0.5">On-chain rep</div>
                    <div className="text-zinc-200">
                      {Number(rep.score)}/100
                      <span className="text-zinc-600 ml-2 text-xs">
                        {rep.successes.toString()}✓ {rep.failures.toString()}✗
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-zinc-600 text-xs mb-0.5">DB score</div>
                    <div className="text-zinc-200">{agent!.reputationScore}</div>
                  </div>
                )}
                {avgRating && (
                  <div>
                    <div className="text-zinc-600 text-xs mb-0.5">Reviews</div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-sm">★</span>
                      <span className="text-zinc-200 text-sm">{avgRating}</span>
                      <span className="text-zinc-500 text-xs">({reviews.length})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {agent?.description && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Description</div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{agent.description}</p>
                </div>
              )}

              {/* System prompt preview */}
              {agent?.systemPrompt && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1">System Prompt (preview)</div>
                  <pre className="text-xs text-zinc-400 bg-zinc-800/60 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {agent.systemPrompt.slice(0, 200)}
                    {agent.systemPrompt.length > 200 && "…"}
                  </pre>
                </div>
              )}

              {/* Reviews */}
              <div>
                <div className="text-xs text-zinc-500 mb-2">
                  Reviews {reviews.length > 0 && `(${reviews.length})`}
                </div>
                {reviews.length === 0 ? (
                  <p className="text-xs text-zinc-600">No reviews yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {reviews.map((r) => (
                      <div key={r.id} className="bg-zinc-800/50 rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Stars rating={r.rating} />
                          <span className="text-xs text-zinc-600">
                            {r.user.username ?? truncateAddr(r.user.walletAddress)}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="text-xs text-zinc-400 leading-relaxed">{r.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {onAddToPipeline && !loading && (
          <div className="px-5 py-4 border-t border-zinc-800">
            <button
              onClick={() => { onAddToPipeline(); onClose(); }}
              disabled={inPipeline}
              className="w-full bg-avax hover:opacity-90 disabled:opacity-40 text-white font-medium py-2 rounded text-sm"
            >
              {inPipeline ? "Already in pipeline" : "Add to Pipeline"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
