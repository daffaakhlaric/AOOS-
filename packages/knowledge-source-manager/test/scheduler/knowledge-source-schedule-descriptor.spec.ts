import { describe, expect, it } from "vitest";

import { knowledgeSourceScheduleDescriptorSchema } from "../../src/scheduler/knowledge-source-schedule-descriptor.js";
import { KnowledgeSourceScheduleMode } from "../../src/scheduler/knowledge-source-schedule-mode.js";

describe("knowledgeSourceScheduleDescriptorSchema", () => {
  it("accepts a Manual descriptor with no extra fields", () => {
    expect(() =>
      knowledgeSourceScheduleDescriptorSchema.parse({ mode: KnowledgeSourceScheduleMode.MANUAL }),
    ).not.toThrow();
  });

  it("rejects a non-positive intervalMs", () => {
    expect(() =>
      knowledgeSourceScheduleDescriptorSchema.parse({
        mode: KnowledgeSourceScheduleMode.INTERVAL,
        intervalMs: 0,
      }),
    ).toThrow();
  });
});
