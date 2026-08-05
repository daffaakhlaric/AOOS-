import { describe, expect, it } from "vitest";

import { advanceCursor, incrementLoopIteration } from "../../src/cursor/advance-cursor.js";
import { createExecutionCursor } from "../../src/cursor/create-execution-cursor.js";
import { executionCursorSchema } from "../../src/cursor/execution-cursor.js";

describe("Cursor Test — ExecutionCursor", () => {
  it("createExecutionCursor() positions at the start Node with singleton history", () => {
    const cursor = createExecutionCursor("start");
    expect(cursor.currentNodeId).toBe("start");
    expect(cursor.previousNodeId).toBeUndefined();
    expect(cursor.visitedNodes).toEqual(["start"]);
    expect(cursor.executionPath).toEqual(["start"]);
    expect(cursor.loopIterations).toEqual({});
    expect(executionCursorSchema.safeParse(cursor).success).toBe(true);
  });

  it("advanceCursor() moves current->previous and appends to visited/path", () => {
    const cursor = createExecutionCursor("start");
    const next = advanceCursor(cursor, "task-1");
    expect(next.currentNodeId).toBe("task-1");
    expect(next.previousNodeId).toBe("start");
    expect(next.visitedNodes).toEqual(["start", "task-1"]);
    expect(next.executionPath).toEqual(["start", "task-1"]);
  });

  it("advanceCursor() does not duplicate an already-visited node in visitedNodes", () => {
    let cursor = createExecutionCursor("start");
    cursor = advanceCursor(cursor, "task-1");
    cursor = advanceCursor(cursor, "start");
    expect(cursor.visitedNodes).toEqual(["start", "task-1"]);
    expect(cursor.executionPath).toEqual(["start", "task-1", "start"]);
  });

  it("advanceCursor() records the full fan-out set in nextNodeIds", () => {
    const cursor = createExecutionCursor("start");
    const next = advanceCursor(cursor, "a", ["a", "b"]);
    expect(next.nextNodeIds).toEqual(["a", "b"]);
  });

  it("incrementLoopIteration() increments a per-node counter without affecting others", () => {
    let cursor = createExecutionCursor("loop-1");
    cursor = incrementLoopIteration(cursor, "loop-1");
    cursor = incrementLoopIteration(cursor, "loop-1");
    expect(cursor.loopIterations["loop-1"]).toBe(2);
    expect(cursor.loopIterations["other"]).toBeUndefined();
  });

  it("advanceCursor() defaults nextNodeIds to a single-element array when no fan-out set is given", () => {
    const cursor = createExecutionCursor("start");
    const next = advanceCursor(cursor, "task-1");
    expect(next.nextNodeIds).toEqual(["task-1"]);
  });

  it("executionCursorSchema rejects a cursor missing currentNodeId", () => {
    expect(
      executionCursorSchema.safeParse({ visitedNodes: [], executionPath: [], loopIterations: {} })
        .success,
    ).toBe(false);
  });

  it("incrementLoopIteration() tracks independent counters for different Node ids", () => {
    let cursor = createExecutionCursor("loop-1");
    cursor = incrementLoopIteration(cursor, "loop-1");
    cursor = incrementLoopIteration(cursor, "loop-2");
    expect(cursor.loopIterations).toEqual({ "loop-1": 1, "loop-2": 1 });
  });
});
