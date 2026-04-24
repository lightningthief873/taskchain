"use client";

import { useState, useRef } from "react";
import type { PipelineEntry } from "@/lib/tasks";
import { priceDisplay, totalDisplay } from "@/lib/tasks";
import type { AgentSummary } from "@/lib/agents";

interface Props {
  pipeline: PipelineEntry[];
  agentMap: Map<string, AgentSummary>;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onContextChange: (index: number, text: string) => void;
  onRun: (inputText: string) => Promise<void>;
  running: boolean;
}

export default function PipelineComposer({
  pipeline,
  agentMap,
  onRemove,
  onMove,
  onContextChange,
  onRun,
  running,
}: Props) {
  const [inputText, setInputText] = useState("");
  const [expandedContexts, setExpandedContexts] = useState<Set<number>>(new Set());
  const dragIndexRef = useRef<number | null>(null);

  const totalRaw = pipeline.reduce((sum, entry) => {
    return sum + (agentMap.get(entry.agentId)?.priceUsdc ?? 0);
  }, 0);
  const totalWithFee = Math.ceil(totalRaw * 1.05);

  function toggleContext(i: number) {
    setExpandedContexts((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function handleDragStart(i: number) {
    dragIndexRef.current = i;
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === i) return;
    onMove(from, i);
    dragIndexRef.current = i;
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
  }

  return (
    <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 self-start border border-zinc-800 rounded-lg bg-zinc-900/60 flex flex-col lg:max-h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-100">Pipeline</span>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
          {pipeline.length} agent{pipeline.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pipeline.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-8">
            Add agents from the marketplace to build your pipeline.
          </p>
        )}

        {pipeline.map((entry, i) => {
          const agent = agentMap.get(entry.agentId);
          if (!agent) return null;
          const expanded = expandedContexts.has(i);

          return (
            <div
              key={`${entry.agentId}-${i}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className="bg-zinc-800/70 border border-zinc-700/50 rounded-md p-2.5 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-zinc-600 text-xs font-mono w-4 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-200 truncate">{agent.name}</div>
                    <div className="text-xs text-avax">{priceDisplay(agent.priceUsdc)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleContext(i)}
                    title="Add step instructions"
                    className="text-zinc-600 hover:text-zinc-300 text-xs px-1.5 py-0.5 rounded hover:bg-zinc-700/50"
                  >
                    {expanded ? "▲" : "▼"}
                  </button>
                  <button
                    onClick={() => onRemove(i)}
                    className="text-zinc-600 hover:text-red-400 text-xs px-1 py-0.5 rounded hover:bg-zinc-700/50"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {expanded && (
                <textarea
                  value={entry.stepContext}
                  onChange={(e) => onContextChange(i, e.target.value)}
                  placeholder="Step-specific instructions (optional)…"
                  rows={2}
                  className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-avax resize-none"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: input + cost + run */}
      <div className="border-t border-zinc-800 p-3 space-y-3">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Your task input…"
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-avax resize-none"
        />

        {pipeline.length > 0 && (
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Total (incl. 5% fee)</span>
            <span className="text-avax font-medium">{totalDisplay(totalWithFee)}</span>
          </div>
        )}

        <button
          onClick={() => void onRun(inputText)}
          disabled={running || pipeline.length === 0}
          className="w-full bg-avax hover:opacity-90 disabled:opacity-40 text-white font-medium py-2 rounded text-sm transition-opacity"
        >
          {running ? "Submitting…" : "Run Pipeline →"}
        </button>
      </div>
    </div>
  );
}
