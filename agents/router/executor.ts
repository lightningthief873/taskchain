import axios from "axios";
import { wrapAxiosWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/axios";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import type { SubTask, AgentInfo, StepResult } from "../../shared/types";
import { FUJI_NETWORK } from "../../shared/config";

function buildAgentPayload(
  agentType: string,
  instruction: string,
  prevOutput: unknown,
  originalPayload: unknown,
): Record<string, unknown> {
  switch (agentType) {
    case "analyzer": {
      const orig = originalPayload as Record<string, unknown> | null;
      return { instruction, data: orig?.data ?? (prevOutput as Record<string, unknown>)?.data };
    }
    case "writer": {
      const prev = prevOutput as Record<string, unknown> | null;
      return { instruction, analysis: prev?.stats ?? prev };
    }
    case "translator": {
      const prev = prevOutput as Record<string, unknown> | null;
      const text = prev?.summary ?? prev?.translatedText ?? String(prevOutput);
      return { text };
    }
    default:
      return { instruction, input: prevOutput };
  }
}

function extractTxHash(headers: Record<string, unknown>): string | undefined {
  const header = headers["x-payment-response"] as string | undefined;
  if (!header) return undefined;
  try {
    const decoded = decodePaymentResponseHeader(header) as Record<string, unknown>;
    const hash = decoded.txHash ?? decoded.transactionHash;
    return typeof hash === "string" ? hash : undefined;
  } catch {
    return undefined;
  }
}

export async function executeSteps(
  steps: SubTask[],
  agents: AgentInfo[],
  originalPayload: unknown,
): Promise<StepResult[]> {
  const routerKey = process.env.ROUTER_AGENT_PRIVATE_KEY as `0x${string}`;
  if (!routerKey) throw new Error("ROUTER_AGENT_PRIVATE_KEY not set");

  const account = privateKeyToAccount(routerKey);
  const api = wrapAxiosWithPaymentFromConfig(axios.create(), {
    schemes: [{ network: FUJI_NETWORK, client: new ExactEvmScheme(account) }],
  });

  const results: StepResult[] = [];
  let prevOutput: unknown = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const agent = agents[i];
    const url = `${agent.url}/execute`;
    const payload = buildAgentPayload(step.agentType, step.instruction, prevOutput, originalPayload);

    console.log(`\n[executor] Step ${i + 1}/${steps.length}: ${step.agentType} → ${url}`);
    console.log(`[executor] Payload:`, JSON.stringify(payload, null, 2));

    const response = await api.post(url, payload);
    const output = response.data as Record<string, unknown>;
    const paymentTxHash = extractTxHash(response.headers as Record<string, unknown>);

    console.log(`[executor] ✓ ${step.agentType} responded`);
    if (paymentTxHash) {
      console.log(`[executor]   Payment tx: https://testnet.snowtrace.io/tx/${paymentTxHash}`);
    }

    results.push({
      agentType: step.agentType,
      instruction: step.instruction,
      output,
      paymentTxHash,
    });

    prevOutput = output;
  }

  return results;
}
