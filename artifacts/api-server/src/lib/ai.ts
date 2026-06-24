import { db, aiTasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { GeoAeoAiTaskType } from "@workspace/shared/geo-aeo";

export type AiTaskType = "cluster" | "brief" | "report" | GeoAeoAiTaskType;

interface AiTaskInput {
  tenantId: number;
  projectId?: number;
  taskType: AiTaskType;
  createdBy: number;
  input: Record<string, unknown>;
}

export async function enqueueAiTask(params: AiTaskInput): Promise<number> {
  const [task] = await db
    .insert(aiTasksTable)
    .values({
      tenantId: params.tenantId,
      projectId: params.projectId ?? null,
      taskType: params.taskType,
      provider: "mock",
      status: "queued",
      input: params.input,
      createdBy: params.createdBy,
    })
    .returning({ id: aiTasksTable.id });

  return task.id;
}

export async function runMockAiTask(taskId: number): Promise<void> {
  await db.update(aiTasksTable).set({ status: "running" }).where(eq(aiTasksTable.id, taskId));

  await new Promise((r) => setTimeout(r, 50));

  await db
    .update(aiTasksTable)
    .set({
      status: "completed",
      output: { mock: true, taskId },
    })
    .where(eq(aiTasksTable.id, taskId));
}
