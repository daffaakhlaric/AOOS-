import { describe, expect, it } from "vitest";

import { KnowledgeUpdateTask } from "../../src/entities/knowledge-update-task.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";

function baseProps() {
  return {
    id: "task-1",
    jobId: "job-1",
    sessionId: "session-1",
    updateType: KnowledgeUpdateType.Manual,
    targetId: "target-1",
    payload: { a: 1 },
    previousPayload: undefined,
    attempt: 0,
    createdAt: 0,
  };
}

describe("KnowledgeUpdateTask", () => {
  it("constructs with valid props", () => {
    const task = new KnowledgeUpdateTask(baseProps());
    expect(task.id).toBe("task-1");
    expect(task.payload).toEqual({ a: 1 });
  });

  it("is frozen", () => {
    expect(Object.isFrozen(new KnowledgeUpdateTask(baseProps()))).toBe(true);
  });

  it("throws on empty id", () => {
    expect(() => new KnowledgeUpdateTask({ ...baseProps(), id: "" })).toThrow(RangeError);
  });

  it("carries previousPayload through when provided", () => {
    const task = new KnowledgeUpdateTask({ ...baseProps(), previousPayload: { a: 0 } });
    expect(task.previousPayload).toEqual({ a: 0 });
  });

  it("carries the attempt number through unchanged", () => {
    const task = new KnowledgeUpdateTask({ ...baseProps(), attempt: 3 });
    expect(task.attempt).toBe(3);
  });

  it("carries the updateType through unchanged", () => {
    const task = new KnowledgeUpdateTask({
      ...baseProps(),
      updateType: KnowledgeUpdateType.Refresh,
    });
    expect(task.updateType).toBe(KnowledgeUpdateType.Refresh);
  });
});
