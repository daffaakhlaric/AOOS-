import { describe, expect, it } from "vitest";

import { createKnowledgeProviderContext } from "../../src/context/create-knowledge-provider-context.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { isKnowledgeProviderToken } from "../../src/token/knowledge-provider-token.js";

function baseInput() {
  return {
    tenantId: "tenant-1",
    providerId: "provider-1",
    providerType: KnowledgeProviderCategory.DOCUMENT,
  };
}

describe("createKnowledgeProviderContext", () => {
  it("generates a token and correlationId when omitted", () => {
    const context = createKnowledgeProviderContext(baseInput());
    expect(isKnowledgeProviderToken(context.token)).toBe(true);
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("preserves caller-supplied token and correlationId", () => {
    const context = createKnowledgeProviderContext({
      ...baseInput(),
      token: "ptok_fixed",
      correlationId: "corr-fixed",
    });
    expect(context.token).toBe("ptok_fixed");
    expect(context.correlationId).toBe("corr-fixed");
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeProviderContext(baseInput());
    expect(context.metadata).toEqual({});
  });

  it("carries through optional identity fields", () => {
    const context = createKnowledgeProviderContext({
      ...baseInput(),
      workspaceId: "workspace-1",
      departmentId: "department-1",
      environment: "test",
      providerVersion: "1.0.0",
      sourceId: "source-1",
      sessionId: "session-1",
      namespace: "ns",
      policy: "policy-1",
      permission: "read",
      traceId: "trace-1",
    });
    expect(context.workspaceId).toBe("workspace-1");
    expect(context.departmentId).toBe("department-1");
    expect(context.environment).toBe("test");
    expect(context.providerVersion).toBe("1.0.0");
    expect(context.sourceId).toBe("source-1");
    expect(context.sessionId).toBe("session-1");
    expect(context.namespace).toBe("ns");
    expect(context.policy).toBe("policy-1");
    expect(context.permission).toBe("read");
    expect(context.traceId).toBe("trace-1");
  });
});
