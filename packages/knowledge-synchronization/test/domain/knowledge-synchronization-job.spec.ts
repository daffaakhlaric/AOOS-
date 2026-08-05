import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationJobType } from "../../src/domain/knowledge-synchronization-job-type.js";
import { knowledgeSynchronizationJobSchema } from "../../src/domain/knowledge-synchronization-job.js";
import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";

describe("knowledgeSynchronizationJobSchema", () => {
  const base = {
    id: "job-1",
    type: KnowledgeSynchronizationJobType.MANUAL_SYNC,
    mode: KnowledgeSynchronizationMode.MANUAL,
    providerId: "provider-1",
    sourceId: "source-1",
    tenantId: "tenant-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts the minimal required shape", () => {
    expect(knowledgeSynchronizationJobSchema.parse(base)).toMatchObject(base);
  });

  it("accepts optional workspaceId/collection/namespace", () => {
    const parsed = knowledgeSynchronizationJobSchema.parse({
      ...base,
      workspaceId: "workspace-1",
      collection: "collection-1",
      namespace: "ns",
    });
    expect(parsed.workspaceId).toBe("workspace-1");
  });

  it("rejects a blank providerId", () => {
    expect(() => knowledgeSynchronizationJobSchema.parse({ ...base, providerId: "" })).toThrow();
  });

  it("rejects a blank tenantId", () => {
    expect(() => knowledgeSynchronizationJobSchema.parse({ ...base, tenantId: "" })).toThrow();
  });
});
