export type AgentType = "analyzer" | "writer" | "translator";

export interface SubTask {
  agentType: AgentType;
  instruction: string;
}

export interface DecomposedTask {
  steps: SubTask[];
}

export interface AgentInfo {
  agentType: AgentType;
  address: string;
  url: string;
  reputation: { successes: bigint; failures: bigint; score: bigint };
}

export interface StepResult {
  agentType: AgentType;
  instruction: string;
  output: unknown;
  paymentTxHash?: string;
  reputationTxHash?: string;
}

export interface TaskResponse {
  taskId: string;
  description: string;
  steps: StepResult[];
  finalResult: unknown;
}
