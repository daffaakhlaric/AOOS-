import { describe, expect, it } from "vitest";

import { NodeState } from "../../src/contracts/node-state.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { nodeHistoryEntrySchema } from "../../src/instance/node-history.js";
import { nodeInstanceSchema } from "../../src/instance/node-instance.js";
import { nodeMetadataSchema } from "../../src/instance/node-metadata.js";
import { nodeResultSchema } from "../../src/instance/node-result.js";
import { nodeSnapshotReferenceSchema } from "../../src/instance/node-snapshot-reference.js";

describe("instance schemas", () => {
  it("nodeHistoryEntrySchema requires fromState/toState/occurredAt", () => {
    expect(
      nodeHistoryEntrySchema.safeParse({
        sequence: 0,
        fromState: NodeState.CREATED,
        toState: NodeState.READY,
        occurredAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
    expect(nodeHistoryEntrySchema.safeParse({ sequence: 0 }).success).toBe(false);
  });

  it("nodeMetadataSchema accepts a free-form record", () => {
    expect(nodeMetadataSchema.safeParse({ any: "thing" }).success).toBe(true);
  });

  it("nodeResultSchema requires success and accepts optional output/error/completedAt", () => {
    expect(nodeResultSchema.safeParse({ success: true, output: { x: 1 } }).success).toBe(true);
    expect(nodeResultSchema.safeParse({}).success).toBe(false);
  });

  it("nodeSnapshotReferenceSchema requires snapshotId/sequence/capturedAt", () => {
    expect(
      nodeSnapshotReferenceSchema.safeParse({
        snapshotId: "s-1",
        sequence: 0,
        capturedAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
    expect(nodeSnapshotReferenceSchema.safeParse({}).success).toBe(false);
  });

  it("nodeInstanceSchema accepts a fully-formed NodeInstance", () => {
    const now = new Date().toISOString();
    const result = nodeInstanceSchema.safeParse({
      id: "i-1",
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
      status: NodeState.CREATED,
      config: {},
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("nodeInstanceSchema rejects a missing required field", () => {
    expect(nodeInstanceSchema.safeParse({ id: "i-1" }).success).toBe(false);
  });
});
