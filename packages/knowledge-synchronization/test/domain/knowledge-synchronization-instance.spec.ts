import { describe, expect, it } from "vitest";

import { knowledgeSynchronizationInstanceSchema } from "../../src/domain/knowledge-synchronization-instance.js";
import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";

describe("knowledgeSynchronizationInstanceSchema", () => {
  const base = {
    id: "i-1",
    token: "stok_abc",
    jobId: "job-1",
    providerId: "provider-1",
    tenantId: "tenant-1",
    state: KnowledgeSynchronizationState.CREATED,
    retryCount: 0,
    changeCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts the minimal required shape", () => {
    expect(knowledgeSynchronizationInstanceSchema.parse(base)).toMatchObject(base);
  });

  it("accepts optional workspaceId/startedAt/completedAt", () => {
    const parsed = knowledgeSynchronizationInstanceSchema.parse({
      ...base,
      workspaceId: "workspace-1",
      startedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "2026-01-01T00:00:02.000Z",
    });
    expect(parsed.workspaceId).toBe("workspace-1");
  });

  it("rejects a negative retryCount", () => {
    expect(() =>
      knowledgeSynchronizationInstanceSchema.parse({ ...base, retryCount: -1 }),
    ).toThrow();
  });

  it("rejects a blank providerId", () => {
    expect(() =>
      knowledgeSynchronizationInstanceSchema.parse({ ...base, providerId: "" }),
    ).toThrow();
  });
});
