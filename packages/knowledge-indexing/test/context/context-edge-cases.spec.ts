import { describe, expect, it } from "vitest";

import { createKnowledgeIndexContext } from "../../src/context/create-knowledge-index-context.js";
import { knowledgeIndexContextSchema } from "../../src/context/knowledge-index-context.js";

describe("Context Test — edge cases", () => {
  it("createKnowledgeIndexContext() leaves optional fields undefined when omitted", () => {
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    expect(context.workspaceId).toBeUndefined();
    expect(context.departmentId).toBeUndefined();
    expect(context.traceId).toBeUndefined();
    expect(context.environment).toBeUndefined();
    expect(context.language).toBeUndefined();
  });

  it("knowledgeIndexContextSchema rejects a missing assetId", () => {
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    const { assetId: _assetId, ...rest } = context;
    expect(knowledgeIndexContextSchema.safeParse(rest).success).toBe(false);
  });

  it("knowledgeIndexContextSchema rejects a missing correlationId", () => {
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    expect(knowledgeIndexContextSchema.safeParse({ ...context, correlationId: "" }).success).toBe(
      false,
    );
  });
});
