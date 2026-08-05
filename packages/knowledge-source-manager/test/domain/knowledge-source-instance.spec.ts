import { describe, expect, it } from "vitest";

import { knowledgeSourceInstanceSchema } from "../../src/domain/knowledge-source-instance.js";
import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";

describe("knowledgeSourceInstanceSchema", () => {
  it("accepts a well-formed instance", () => {
    const now = new Date().toISOString();
    expect(() =>
      knowledgeSourceInstanceSchema.parse({
        id: "i-1",
        token: "ksrc_1",
        sourceId: "source-1",
        providerId: "provider-1",
        tenantId: "tenant-1",
        state: KnowledgeSourceState.CREATED,
        createdAt: now,
        updatedAt: now,
      }),
    ).not.toThrow();
  });

  it("rejects a missing token", () => {
    expect(() =>
      knowledgeSourceInstanceSchema.parse({
        id: "i-1",
        sourceId: "source-1",
        providerId: "provider-1",
        tenantId: "tenant-1",
        state: KnowledgeSourceState.CREATED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
