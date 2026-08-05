import { describe, expect, it } from "vitest";

import { createKnowledgeIndexContext } from "../../src/context/create-knowledge-index-context.js";
import { knowledgeIndexContextSchema } from "../../src/context/knowledge-index-context.js";

describe("Context Test — KnowledgeIndexContext", () => {
  it("createKnowledgeIndexContext() generates correlationId when omitted", () => {
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    expect(context.correlationId).toBeTruthy();
    expect(context.metadata).toEqual({});
    expect(context.variables).toEqual({});
  });

  it("createKnowledgeIndexContext() honors explicit overrides", () => {
    const context = createKnowledgeIndexContext({
      assetId: "a-1",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      workspaceId: "ws-1",
      language: "en",
      metadata: { source: "test" },
      variables: { a: 1 },
    });
    expect(context.correlationId).toBe("corr-1");
    expect(context.workspaceId).toBe("ws-1");
    expect(context.language).toBe("en");
    expect(context.metadata).toEqual({ source: "test" });
    expect(context.variables).toEqual({ a: 1 });
  });

  it("knowledgeIndexContextSchema accepts a constructed Context", () => {
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    expect(knowledgeIndexContextSchema.safeParse(context).success).toBe(true);
  });

  it("knowledgeIndexContextSchema rejects an empty tenantId", () => {
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    expect(knowledgeIndexContextSchema.safeParse({ ...context, tenantId: "" }).success).toBe(false);
  });
});
