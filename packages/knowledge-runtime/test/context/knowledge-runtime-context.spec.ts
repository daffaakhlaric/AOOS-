import { describe, expect, it } from "vitest";

import { createKnowledgeRuntimeContext } from "../../src/context/create-knowledge-runtime-context.js";
import { knowledgeRuntimeContextSchema } from "../../src/context/knowledge-runtime-context.js";

describe("Context Test — KnowledgeRuntimeContext", () => {
  it("createKnowledgeRuntimeContext() generates runtimeId/token/correlationId when omitted", () => {
    const context = createKnowledgeRuntimeContext({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(context.runtimeId).toBeTruthy();
    expect(context.token).toBeTruthy();
    expect(context.correlationId).toBeTruthy();
    expect(context.executionScope).toEqual({ tenantId: "tenant-1", workspaceId: undefined });
  });

  it("createKnowledgeRuntimeContext() honors explicit overrides", () => {
    const context = createKnowledgeRuntimeContext({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      runtimeId: "r-1",
      token: "ktok_fixed",
      correlationId: "corr-1",
      workspaceId: "ws-1",
      permission: "perm-1",
      policy: "policy-1",
      variables: { a: 1 },
      metadata: { source: "test" },
    });
    expect(context.runtimeId).toBe("r-1");
    expect(context.token).toBe("ktok_fixed");
    expect(context.correlationId).toBe("corr-1");
    expect(context.permission).toBe("perm-1");
    expect(context.policy).toBe("policy-1");
    expect(context.variables).toEqual({ a: 1 });
    expect(context.metadata).toEqual({ source: "test" });
  });

  it("knowledgeRuntimeContextSchema accepts a constructed Context", () => {
    const context = createKnowledgeRuntimeContext({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(knowledgeRuntimeContextSchema.safeParse(context).success).toBe(true);
  });

  it("knowledgeRuntimeContextSchema rejects an empty tenantId", () => {
    const context = createKnowledgeRuntimeContext({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const result = knowledgeRuntimeContextSchema.safeParse({ ...context, tenantId: "" });
    expect(result.success).toBe(false);
  });
});
