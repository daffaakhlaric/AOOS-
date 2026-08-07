import { describe, expect, it } from "vitest";

import { KnowledgeUpdateSession } from "../../src/entities/knowledge-update-session.js";

describe("KnowledgeUpdateSession", () => {
  it("constructs with valid props", () => {
    const session = new KnowledgeUpdateSession({
      id: "s-1",
      taskIds: [],
      resultIds: [],
      startedAt: 0,
      completedAt: undefined,
    });
    expect(session.id).toBe("s-1");
    expect(session.completedAt).toBeUndefined();
  });

  it("is frozen, including its arrays", () => {
    const session = new KnowledgeUpdateSession({
      id: "s-1",
      taskIds: [],
      resultIds: [],
      startedAt: 0,
      completedAt: undefined,
    });
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.taskIds)).toBe(true);
    expect(Object.isFrozen(session.resultIds)).toBe(true);
  });

  it("withTaskId appends a task id immutably", () => {
    const session = new KnowledgeUpdateSession({
      id: "s-1",
      taskIds: [],
      resultIds: [],
      startedAt: 0,
      completedAt: undefined,
    });
    const updated = session.withTaskId("task-1");
    expect(updated.taskIds).toEqual(["task-1"]);
    expect(session.taskIds).toEqual([]);
  });

  it("withResultId appends a result id immutably", () => {
    const session = new KnowledgeUpdateSession({
      id: "s-1",
      taskIds: [],
      resultIds: [],
      startedAt: 0,
      completedAt: undefined,
    });
    const updated = session.withResultId("result-1");
    expect(updated.resultIds).toEqual(["result-1"]);
  });

  it("withTaskId and withResultId can be chained", () => {
    const session = new KnowledgeUpdateSession({
      id: "s-1",
      taskIds: [],
      resultIds: [],
      startedAt: 0,
      completedAt: undefined,
    });
    const updated = session.withTaskId("t-1").withResultId("r-1").withTaskId("t-2");
    expect(updated.taskIds).toEqual(["t-1", "t-2"]);
    expect(updated.resultIds).toEqual(["r-1"]);
  });

  it("withCompletedAt sets completedAt", () => {
    const session = new KnowledgeUpdateSession({
      id: "s-1",
      taskIds: [],
      resultIds: [],
      startedAt: 0,
      completedAt: undefined,
    });
    const updated = session.withCompletedAt(500);
    expect(updated.completedAt).toBe(500);
  });
});
