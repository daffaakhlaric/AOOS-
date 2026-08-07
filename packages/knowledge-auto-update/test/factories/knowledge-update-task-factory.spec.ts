import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdateTaskFactory } from "../../src/factories/knowledge-update-task-factory.js";
import { resetFixtureState, makeJob } from "../helpers/fixtures.js";

describe("KnowledgeUpdateTaskFactory", () => {
  beforeEach(resetFixtureState);

  it("derives a task from a job", () => {
    const job = makeJob({ id: "job-1", targetId: "target-9", payload: { a: 1 }, attempt: 2 });
    const task = new KnowledgeUpdateTaskFactory().create(job, "session-1", 500);
    expect(task.jobId).toBe("job-1");
    expect(task.sessionId).toBe("session-1");
    expect(task.targetId).toBe("target-9");
    expect(task.payload).toEqual({ a: 1 });
    expect(task.attempt).toBe(2);
    expect(task.createdAt).toBe(500);
  });

  it("carries forward previousPayload", () => {
    const job = makeJob({ previousPayload: { a: 0 } });
    const task = new KnowledgeUpdateTaskFactory().create(job, "s", 0);
    expect(task.previousPayload).toEqual({ a: 0 });
  });
});
