import { SNOWTRACE } from "@/lib/config";

interface StepResultProps {
  index: number;
  agentType: string;
  instruction: string;
  output: unknown;
  paymentTxHash?: string;
}

function getOutputPreview(agentType: string, output: unknown): React.ReactNode {
  const o = output as Record<string, unknown>;

  if (agentType === "analyzer" && o?.stats) {
    const s = o.stats as Record<string, unknown>;
    return (
      <div className="grid grid-cols-3 gap-2 mt-2">
        {(["min", "max", "mean", "median", "sum", "count"] as const).map((k) =>
          s[k] !== undefined ? (
            <div key={k} className="bg-zinc-800/60 rounded px-2 py-1.5 text-center">
              <div className="text-xs text-zinc-500 uppercase">{k}</div>
              <div className="text-sm font-mono text-zinc-200 mt-0.5">{String(s[k])}</div>
            </div>
          ) : null,
        )}
      </div>
    );
  }

  if (agentType === "writer" && typeof o?.summary === "string") {
    return (
      <p className="mt-2 text-sm text-zinc-300 leading-relaxed italic border-l-2 border-zinc-700 pl-3">
        {o.summary}
      </p>
    );
  }

  if (agentType === "translator" && typeof o?.translatedText === "string") {
    return (
      <p className="mt-2 text-sm text-emerald-300 leading-relaxed font-medium">
        {o.translatedText}
      </p>
    );
  }

  return (
    <pre className="mt-2 text-xs text-zinc-400 overflow-x-auto bg-zinc-800/50 p-2 rounded">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

export default function StepResult({
  index,
  agentType,
  instruction,
  output,
  paymentTxHash,
}: StepResultProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 text-xs flex items-center justify-center font-mono">
            {index}
          </span>
          <span className="font-semibold text-zinc-100 uppercase tracking-wide text-sm">
            {agentType}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded badge-success">✓ paid 0.01 USDC</span>
        </div>
        {paymentTxHash && (
          <a
            href={`${SNOWTRACE}/tx/${paymentTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-zinc-600 hover:text-avax transition-colors"
          >
            {paymentTxHash.slice(0, 14)}… ↗
          </a>
        )}
      </div>
      <p className="text-xs text-zinc-500 mt-2 italic">{instruction}</p>
      {getOutputPreview(agentType, output)}
    </div>
  );
}
