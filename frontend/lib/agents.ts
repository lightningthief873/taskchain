import { authHeaders } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

export interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  priceUsdc: number;
  endpoint: string;
  agentWalletAddress: string | null;
  reputationScore: number;
  isActive: boolean;
  createdAt: string;
  owner: { id: string; username: string | null; walletAddress: string };
}

export interface AgentDetail extends AgentSummary {
  systemPrompt: string | null;
  contextText: string | null;
}

export async function listAgents(params?: { sort?: string; search?: string }): Promise<AgentSummary[]> {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.search) qs.set("search", params.search);
  const res = await fetch(`${API_URL}/agents?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

export async function getAgent(id: string): Promise<AgentDetail> {
  const res = await fetch(`${API_URL}/agents/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Agent not found");
  return res.json();
}

export async function createAgent(data: {
  name: string;
  description: string;
  systemPrompt: string;
  contextText: string;
  priceUsdc: number;
}): Promise<AgentDetail> {
  const res = await fetch(`${API_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create agent");
  }
  return res.json();
}

export async function updateAgent(
  id: string,
  data: Partial<{ name: string; description: string; systemPrompt: string; contextText: string; priceUsdc: number }>,
): Promise<AgentDetail> {
  const res = await fetch(`${API_URL}/agents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update agent");
  return res.json();
}

export async function deactivateAgent(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/agents/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to deactivate agent");
}

export async function uploadContextFile(agentId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/agents/${agentId}/context-file`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error("File upload failed");
}
