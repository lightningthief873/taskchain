/**
 * Task executor — runs a pipeline of agents sequentially.
 *
 * Triggered by POST /tasks/:id/start.
 * Uses the internal runner bypass (X-Internal-Key) so no USDC float is needed.
 * Each step's output feeds into the next step's input.
 * Emits socket.io events so the frontend can show live progress.
 */
import axios from "axios";
import type { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RUNNER_BASE = process.env.RUNNER_URL ?? "http://localhost:4000";
const INTERNAL_KEY = process.env.AGENT_MASTER_KEY ?? "";

export async function executeTask(taskId: string, io: Server): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      steps: {
        orderBy: { stepIndex: "asc" },
        include: { agent: { select: { id: true, name: true } } },
      },
    },
  });

  if (!task) {
    console.warn(`[executor] Task ${taskId} not found`);
    return;
  }

  await prisma.task.update({ where: { id: taskId }, data: { status: "RUNNING" } });

  const inputText =
    (task.inputPayload as { text?: string }).text ?? "";
  let prevOutput: string | null = null;

  for (const step of task.steps) {
    await prisma.taskStep.update({
      where: { id: step.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    io.to(`task:${taskId}`).emit("task:step:start", {
      stepId: step.id,
      stepIndex: step.stepIndex,
      agentName: step.agent.name,
    });

    try {
      // Build the input for this step
      const parts: string[] = [inputText];
      if (prevOutput) parts.push(`\nPrevious step output:\n${prevOutput}`);
      if (step.stepContext) parts.push(`\nInstructions for this step: ${step.stepContext}`);
      const stepInput = parts.join("");

      const response = await axios.post<{ output: string }>(
        `${RUNNER_BASE}/run/${step.agentId}`,
        { input: stepInput },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": INTERNAL_KEY,
          },
          timeout: 60_000,
        },
      );

      const output = response.data.output ?? "";
      prevOutput = output;

      await prisma.taskStep.update({
        where: { id: step.id },
        data: {
          status: "COMPLETE",
          outputPayload: { output },
          completedAt: new Date(),
        },
      });

      io.to(`task:${taskId}`).emit("task:step:complete", {
        stepId: step.id,
        stepIndex: step.stepIndex,
        output,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[executor] Step ${step.id} failed:`, msg);

      await prisma.taskStep.update({
        where: { id: step.id },
        data: { status: "FAILED", completedAt: new Date() },
      });
      await prisma.task.update({ where: { id: taskId }, data: { status: "FAILED" } });

      io.to(`task:${taskId}`).emit("task:step:failed", {
        stepId: step.id,
        stepIndex: step.stepIndex,
        error: msg,
      });
      return;
    }
  }

  // All steps succeeded — mark awaiting approval
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "AWAITING_APPROVAL",
      outputPayload: { finalOutput: prevOutput ?? "" },
    },
  });

  io.to(`task:${taskId}`).emit("task:complete", { output: prevOutput ?? "" });
  console.log(`[executor] Task ${taskId} complete — awaiting approval`);
}
