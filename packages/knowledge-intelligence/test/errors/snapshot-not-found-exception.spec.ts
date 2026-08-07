import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";
import { SnapshotNotFoundException } from "../../src/errors/snapshot-not-found-exception.js";

describe("SnapshotNotFoundException", () => {
  it("carries the snapshot id and a stable code", () => {
    const error = new SnapshotNotFoundException("snap-1");
    expect(error.code).toBe("SNAPSHOT_NOT_FOUND");
    expect(error.context).toEqual({ snapshotId: "snap-1" });
  });

  it("is a KnowledgeIntelligenceException", () => {
    expect(new SnapshotNotFoundException("x")).toBeInstanceOf(KnowledgeIntelligenceException);
  });
});
