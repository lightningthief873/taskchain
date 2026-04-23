import { authHeaders } from "./auth";
import type { AgentSummary } from "./agents";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

export interface PipelineEntry {
  agentId: string;
  stepContext: string;
}

export interface Review {
  id: string;
  agentId: string;
  userId: string;
  taskStepId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; username: string | null; walletAddress: string };
}

export interface TaskStep {
  id: string;
  taskId: string;
  agentId: string;
  stepIndex: number;
  stepContext: string | null;
  status: string;
  inputPayload: unknown;
  outputPayload: unknown;
  paymentTxHash: string | null;
  startedAt: string | null;
  completedAt: string | null;
  agent: Pick<AgentSummary, "id" | "name" | "priceUsdc" | "agentWalletAddress" | "reputationScore">;
  reviews: Review[];
}

export interface Task {
  id: string;
  userId: string;
  pipeline: unknown;
  status: string;
  inputPayload: { text?: string; data?: unknown };
  outputPayload: unknown;
  totalCostUsdc: number | null;
  escrowTxHash: string | null;
  createdAt: string;
  completedAt: string | null;
  steps: TaskStep[];
  user: { id: string; username: string | null; walletAddress: string };
}

export interface CreateTaskResult {
  taskId: string;
  taskId32: string;
  totalCostUsdc: number;
  escrowAddress: string | null;
  escrowContract: string | null;
  agentAddresses: string[];
  agentAmounts: number[];
  status: string;
  steps: TaskStep[];
}

export async function createTask(data: {
  pipeline: PipelineEntry[];
  inputPayload: { text?: string; data?: unknown };
}): Promise<CreateTaskResult> {
  const res = await fetch(`${API_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create task");
  }
  return res.json();
}

export async function getTask(id: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${id}`);
  if (!res.ok) throw new Error("Task not found");
  return res.json();
}

export async function getMyTasks(): Promise<Task[]> {
  const res = await fetch(`${API_URL}/tasks/my`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function submitReview(
  taskId: string,
  stepId: string,
  rating: number,
  comment?: string,
): Promise<Review> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/steps/${stepId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ rating, comment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to submit review");
  }
  return res.json();
}

export async function getAgentReviews(agentId: string): Promise<Review[]> {
  const res = await fetch(`${API_URL}/agents/${agentId}/reviews`);
  if (!res.ok) return [];
  return res.json();
}

export function priceDisplay(raw: number) {
  return (raw / 1_000_000).toFixed(4).replace(/\.?0+$/, "") + " USDC";
}

export function totalDisplay(raw: number) {
  return "$" + (raw / 1_000_000).toFixed(4).replace(/\.?0+$/, "");
}
