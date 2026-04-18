/**
 * Phase 2 integration test:
 * Sends a 3-step task to the router agent:
 *   1. Analyze data [1,2,3,4,5] → compute statistics
 *   2. Write a summary paragraph from the analysis
 *   3. Translate the summary to Spanish
 *
 * Expects 3 x402 payments and 3 on-chain reputation updates.
 *
 * Prerequisites:
 *   Terminal 1: npx ts-node x402/facilitator.ts
 *   Terminal 2: npx ts-node agents/analyzer/index.ts
 *   Terminal 3: npx ts-node agents/writer/index.ts
 *   Terminal 4: npx ts-node agents/translator/index.ts
 *   Terminal 5: npx ts-node agents/router/index.ts
 */
import axios from "axios";
import * as dotenv from "dotenv";
import { ROUTER_PORT } from "../shared/config";
import type { TaskResponse, StepResult } from "../shared/types";

dotenv.config();

async function main() {
  const url = `http://localhost:${ROUTER_PORT}/task`;

  const body = {
    description: "Analyze this data: [1,2,3,4,5], write a one-paragraph summary, translate it to Spanish",
    payload: { data: [1, 2, 3, 4, 5] },
  };

  console.log("=== TaskChain Phase 2 — Full Flow Test ===\n");
  console.log(`POST ${url}`);
  console.log("Body:", JSON.stringify(body, null, 2));
  console.log("\nRunning pipeline (analyzer → writer → translator)...\n");
  console.log("Each step triggers an x402 payment + on-chain reputation update.\n");

  try {
    const response = await axios.post<TaskResponse>(url, body, { timeout: 120_000 });
    const task = response.data;

    console.log("=== TASK COMPLETE ===\n");
    console.log(`Task ID: ${task.taskId}`);
    console.log(`Steps:   ${task.steps.length}\n`);

    task.steps.forEach((step: StepResult, i: number) => {
      console.log(`--- Step ${i + 1}: ${step.agentType.toUpperCase()} ---`);
      console.log(`Instruction: ${step.instruction}`);
      if (step.paymentTxHash) {
        console.log(`Payment tx:  https://testnet.snowtrace.io/tx/${step.paymentTxHash}`);
      }
      console.log(`Output:`, JSON.stringify(step.output, null, 2));
      console.log();
    });

    const final = task.finalResult as Record<string, unknown>;
    console.log("=== FINAL RESULT ===\n");
    if (final?.translatedText) {
      console.log("Spanish translation:");
      console.log(final.translatedText);
    } else {
      console.log(JSON.stringify(task.finalResult, null, 2));
    }

    console.log("\n=== TEST PASSED ===");
    console.log("\nVerify reputation updates on Fuji explorer:");
    console.log(`  AgentRegistry: https://testnet.snowtrace.io/address/${process.env.AGENT_REGISTRY_ADDRESS}`);
    console.log("\nExpected: 3 on-chain reputation updates (analyzer, writer, translator)\n");
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("\nRequest failed:", err.response?.status, err.response?.data ?? err.message);
    } else {
      console.error("\nError:", err instanceof Error ? err.message : err);
    }
    process.exit(1);
  }
}

main();
