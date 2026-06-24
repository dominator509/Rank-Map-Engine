import { describe, expect, it } from "vitest";
import {
  GEO_AEO_AI_TASK_REGISTRY,
  GEO_AEO_AI_TASK_TYPES,
  getGeoAeoAiTaskDefinition,
} from "./ai-tasks.js";

describe("GEO/AEO AI task registry", () => {
  it("registers every required task type", () => {
    expect(GEO_AEO_AI_TASK_REGISTRY.map((task) => task.taskType)).toEqual([
      ...GEO_AEO_AI_TASK_TYPES,
    ]);
  });

  it("validates deterministic mock output", () => {
    for (const definition of GEO_AEO_AI_TASK_REGISTRY) {
      expect(definition.outputSchema.safeParse(definition.mockOutput).success).toBe(true);
      expect(definition.requiresApproval).toBe(true);
    }
  });

  it("looks up definitions by task type", () => {
    expect(getGeoAeoAiTaskDefinition("geoAeo.generateClientReportSections").mockOutput.summary).toContain(
      "Mock",
    );
  });
});
