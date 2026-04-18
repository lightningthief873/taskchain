import Anthropic from "@anthropic-ai/sdk";
import type { SubTask, DecomposedTask } from "../../shared/types";

// Static mock map — covers the canonical test task without spending API credits.
// Maps lowercased keywords to agent types.
const MOCK_STEPS: SubTask[] = [
  { agentType: "analyzer", instruction: "Compute statistics for the provided data array" },
  { agentType: "writer", instruction: "Write a one-paragraph summary of the analysis results" },
  { agentType: "translator", instruction: "Translate the paragraph to Spanish" },
];

export async function decompose(description: string): Promise<DecomposedTask> {
  if (process.env.MOCK_DECOMPOSITION === "true") {
    console.log("[decomposer] Mock mode — using static 3-step plan");
    return { steps: MOCK_STEPS };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are a task decomposition engine for a multi-agent system.
Available agent types: "analyzer" (computes stats on numeric arrays), "writer" (writes prose summaries), "translator" (translates text to Spanish).
Given a task description, return a JSON object with key "steps" — an ordered array of {agentType, instruction} objects.
Return ONLY valid JSON, no prose.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: `Task: ${description}` }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  const parsed = JSON.parse(cleaned) as DecomposedTask;

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Decomposer returned empty steps");
  }

  return parsed;
}
