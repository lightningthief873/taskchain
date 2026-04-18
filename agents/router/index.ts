import express from "express";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { decompose } from "./decomposer";
import { selectAgent } from "./selector";
import { executeSteps } from "./executor";
import type { TaskResponse } from "../../shared/types";
import { ROUTER_PORT } from "../../shared/config";

dotenv.config();

const app = express();
app.use(express.json());

app.post("/task", async (req, res) => {
  const { description, payload } = req.body as { description?: string; payload?: unknown };
  if (!description || typeof description !== "string") {
    res.status(400).json({ error: "Missing 'description' string in request body" });
    return;
  }

  const taskId = ethers.hexlify(ethers.randomBytes(32));
  console.log(`\n[router] Task ${taskId}`);
  console.log(`[router] Description: ${description}`);

  try {
    // 1. Decompose
    console.log("\n[router] Decomposing task...");
    const { steps } = await decompose(description);
    console.log(`[router] ${steps.length} steps: ${steps.map((s) => s.agentType).join(" → ")}`);

    // 2. Select best agent for each step
    console.log("\n[router] Selecting agents...");
    const agents = await Promise.all(steps.map((s) => selectAgent(s.agentType)));

    // 3. Execute pipeline
    console.log("\n[router] Executing pipeline...");
    const stepResults = await executeSteps(steps, agents, payload);

    const finalResult = stepResults[stepResults.length - 1]?.output;

    const response: TaskResponse = {
      taskId,
      description,
      steps: stepResults,
      finalResult,
    };

    console.log("\n[router] ✓ Task complete");
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[router] Task failed:", message);
    res.status(500).json({ error: "Task execution failed", details: message, taskId });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    agent: "router",
    network: "eip155:43113",
    endpoints: { task: `POST http://localhost:${ROUTER_PORT}/task` },
  });
});

app.listen(ROUTER_PORT, () => {
  console.log(`\nRouter agent running on port ${ROUTER_PORT}`);
  console.log(`  POST http://localhost:${ROUTER_PORT}/task`);
  console.log(`  Body: { description: string, payload: { data: number[] } }\n`);
});
