import { describe, expect, it } from "vitest";

import { KnowledgeIndexScheduleJobType } from "../../src/scheduler/knowledge-index-schedule-job-type.js";
import { knowledgeIndexScheduleJobSchema } from "../../src/scheduler/knowledge-index-schedule-job.js";

describe("Scheduler Test — knowledgeIndexScheduleJobSchema", () => {
  it("accepts a valid pending job", () => {
    const result = knowledgeIndexScheduleJobSchema.safeParse({
      id: "j-1",
      type: KnowledgeIndexScheduleJobType.REINDEX,
      status: "pending",
      scheduledAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("accepts a completed job with all optional timestamps", () => {
    const now = new Date().toISOString();
    const result = knowledgeIndexScheduleJobSchema.safeParse({
      id: "j-1",
      type: KnowledgeIndexScheduleJobType.FULL,
      assetId: "a-1",
      status: "completed",
      scheduledAt: now,
      startedAt: now,
      completedAt: now,
      reason: "done",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = knowledgeIndexScheduleJobSchema.safeParse({
      id: "j-1",
      type: KnowledgeIndexScheduleJobType.REINDEX,
      status: "bogus",
      scheduledAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown job type", () => {
    const result = knowledgeIndexScheduleJobSchema.safeParse({
      id: "j-1",
      type: "bogus",
      status: "pending",
      scheduledAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("declares exactly 6 job types", () => {
    expect(Object.values(KnowledgeIndexScheduleJobType)).toHaveLength(6);
  });
});
