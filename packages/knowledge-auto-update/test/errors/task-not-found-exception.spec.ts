import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { TaskNotFoundException } from "../../src/errors/task-not-found-exception.js";

describe("TaskNotFoundException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new TaskNotFoundException("task-1")).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code TASK_NOT_FOUND", () => {
    expect(new TaskNotFoundException("task-1").code).toBe("TASK_NOT_FOUND");
  });

  it("includes the task id in message and context", () => {
    const error = new TaskNotFoundException("task-9");
    expect(error.message).toContain("task-9");
    expect(error.context).toEqual({ taskId: "task-9" });
  });
});
