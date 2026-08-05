import { describe, expect, it } from "vitest";

import { executionPointerSchema } from "../../src/instance/execution-pointer.js";
import { InstanceState } from "../../src/instance/instance-state.js";
import { workflowHistoryEntrySchema } from "../../src/instance/workflow-history.js";
import { workflowInstanceMetadataSchema } from "../../src/instance/workflow-instance-metadata.js";
import { workflowInstanceSchema } from "../../src/instance/workflow-instance.js";
import { workflowSnapshotReferenceSchema } from "../../src/instance/workflow-snapshot-reference.js";

describe("instance schemas", () => {
  it("executionPointerSchema accepts an empty pointer and a populated one", () => {
    expect(executionPointerSchema.safeParse({}).success).toBe(true);
    expect(
      executionPointerSchema.safeParse({
        currentNodeId: "n-1",
        previousNodeId: "n-0",
        enteredAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });

  it("workflowHistoryEntrySchema requires fromState/toState/occurredAt", () => {
    expect(
      workflowHistoryEntrySchema.safeParse({
        sequence: 0,
        fromState: InstanceState.CREATED,
        toState: InstanceState.READY,
        occurredAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
    expect(workflowHistoryEntrySchema.safeParse({ sequence: 0 }).success).toBe(false);
  });

  it("workflowInstanceMetadataSchema accepts a free-form record", () => {
    expect(
      workflowInstanceMetadataSchema.safeParse({ any: "thing", nested: { a: 1 } }).success,
    ).toBe(true);
  });

  it("workflowSnapshotReferenceSchema requires snapshotId/sequence/capturedAt", () => {
    expect(
      workflowSnapshotReferenceSchema.safeParse({
        snapshotId: "s-1",
        sequence: 0,
        capturedAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
    expect(workflowSnapshotReferenceSchema.safeParse({}).success).toBe(false);
  });

  it("workflowInstanceSchema accepts a fully-formed WorkflowInstance", () => {
    const now = new Date().toISOString();
    const result = workflowInstanceSchema.safeParse({
      id: "i-1",
      token: "wtok_x",
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: InstanceState.CREATED,
      executionPointer: {},
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("workflowInstanceSchema rejects a missing required field", () => {
    expect(workflowInstanceSchema.safeParse({ id: "i-1" }).success).toBe(false);
  });
});
