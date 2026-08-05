import { describe, expect, it } from "vitest";

import { knowledgeRetrievalInstanceSchema } from "../../src/domain/knowledge-retrieval-instance.js";
import { KnowledgeRetrievalState } from "../../src/domain/knowledge-retrieval-state.js";

describe("knowledgeRetrievalInstanceSchema", () => {
  const base = {
    id: "i-1",
    token: "rtok_abc",
    queryId: "q-1",
    tenantId: "tenant-1",
    state: KnowledgeRetrievalState.CREATED,
    resultCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts the minimal required shape", () => {
    expect(knowledgeRetrievalInstanceSchema.parse(base)).toMatchObject(base);
  });

  it("accepts optional workspaceId/startedAt/completedAt", () => {
    const parsed = knowledgeRetrievalInstanceSchema.parse({
      ...base,
      workspaceId: "workspace-1",
      startedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "2026-01-01T00:00:02.000Z",
    });
    expect(parsed.workspaceId).toBe("workspace-1");
  });

  it("rejects a negative resultCount", () => {
    expect(() => knowledgeRetrievalInstanceSchema.parse({ ...base, resultCount: -1 })).toThrow();
  });

  it("rejects a blank tenantId", () => {
    expect(() => knowledgeRetrievalInstanceSchema.parse({ ...base, tenantId: "" })).toThrow();
  });
});
