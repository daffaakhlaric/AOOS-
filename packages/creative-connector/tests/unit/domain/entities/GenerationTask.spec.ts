import { describe, expect, it } from "vitest";

import { GenerationTask } from "../../../../src/domain/entities/GenerationTask.js";
import { TaskId } from "../../../../src/domain/value-objects/TaskId.js";
import { TaskStatus } from "../../../../src/domain/value-objects/TaskStatus.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function taskId(): TaskId {
  return unwrap(TaskId.create("task_1"));
}

describe("GenerationTask", () => {
  it("creates a video task", () => {
    const task = unwrap(
      GenerationTask.create({
        taskId: taskId(),
        kind: "video",
        status: TaskStatus.PENDING,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
    );
    expect(task.kind).toBe("video");
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.taskId.toString()).toBe("task_1");
    expect(task.createdAt).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("creates an image task", () => {
    const task = unwrap(
      GenerationTask.create({
        taskId: taskId(),
        kind: "image",
        status: TaskStatus.PENDING,
        createdAt: new Date(),
      }),
    );
    expect(task.kind).toBe("image");
  });

  it("rejects an invalid kind", () => {
    const error = unwrapErr(
      GenerationTask.create({
        taskId: taskId(),
        kind: "audio" as never,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
      }),
    );
    expect(error.message).toMatch(/"video" or "image"/);
  });

  it("withStatus returns a new immutable instance with the updated status", () => {
    const original = unwrap(
      GenerationTask.create({
        taskId: taskId(),
        kind: "video",
        status: TaskStatus.PENDING,
        createdAt: new Date(),
      }),
    );
    const updated = original.withStatus(TaskStatus.SUCCESS);
    expect(updated.status).toBe(TaskStatus.SUCCESS);
    expect(original.status).toBe(TaskStatus.PENDING);
    expect(updated).not.toBe(original);
  });
});
