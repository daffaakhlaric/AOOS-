import { describe, expect, it } from "vitest";

import { TaskId } from "../../../src/domain/value-objects/TaskId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("TaskId", () => {
  it("creates a valid TaskId from a non-empty string", () => {
    const taskId = unwrap(TaskId.create("task_veo_1765178608584"));
    expect(taskId.toString()).toBe("task_veo_1765178608584");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(TaskId.create(""));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("rejects a whitespace-only string", () => {
    const error = unwrapErr(TaskId.create("   "));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("rejects a non-string value", () => {
    const error = unwrapErr(TaskId.create(123 as unknown as string));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("two TaskIds with the same value are equal", () => {
    const a = unwrap(TaskId.create("task_1"));
    const b = unwrap(TaskId.create("task_1"));
    expect(a.equals(b)).toBe(true);
  });

  it("two TaskIds with different values are not equal", () => {
    const a = unwrap(TaskId.create("task_1"));
    const b = unwrap(TaskId.create("task_2"));
    expect(a.equals(b)).toBe(false);
  });
});
