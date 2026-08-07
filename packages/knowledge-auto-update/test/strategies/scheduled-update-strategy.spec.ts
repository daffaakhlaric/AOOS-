import { describe, expect, it } from "vitest";

import { ScheduledUpdateStrategy } from "../../src/strategies/scheduled-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("ScheduledUpdateStrategy", () => {
  it("declares updateType Scheduled", () => {
    expect(new ScheduledUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Scheduled);
  });

  it("full-replaces with the task payload", () => {
    const task = makeTask({ payload: { a: 2 } });
    const result = new ScheduledUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 2 });
  });

  it("reports success and jobId/taskId linkage on the result", () => {
    const task = makeTask({ payload: { a: 2 } });
    const result = new ScheduledUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
    expect(result.taskId).toBe(task.id);
    expect(result.jobId).toBe(task.jobId);
  });
});
