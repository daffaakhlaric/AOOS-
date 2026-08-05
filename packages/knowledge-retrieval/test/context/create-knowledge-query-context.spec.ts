import { describe, expect, it } from "vitest";

import { createKnowledgeQueryContext } from "../../src/context/create-knowledge-query-context.js";
import { isKnowledgeRetrievalToken } from "../../src/token/knowledge-retrieval-token.js";

describe("createKnowledgeQueryContext", () => {
  it("generates a token and correlationId when omitted", () => {
    const context = createKnowledgeQueryContext({ tenantId: "tenant-1" });
    expect(isKnowledgeRetrievalToken(context.token)).toBe(true);
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("preserves a caller-supplied token and correlationId", () => {
    const context = createKnowledgeQueryContext({
      tenantId: "tenant-1",
      token: "rtok_fixed",
      correlationId: "corr-fixed",
    });
    expect(context.token).toBe("rtok_fixed");
    expect(context.correlationId).toBe("corr-fixed");
  });

  it("preserves caller-supplied variables/metadata", () => {
    const context = createKnowledgeQueryContext({
      tenantId: "tenant-1",
      variables: { foo: "bar" },
      metadata: { baz: 1 },
    });
    expect(context.variables).toEqual({ foo: "bar" });
    expect(context.metadata).toEqual({ baz: 1 });
  });

  it("leaves traceId undefined when omitted", () => {
    const context = createKnowledgeQueryContext({ tenantId: "tenant-1" });
    expect(context.traceId).toBeUndefined();
  });

  it("preserves a caller-supplied traceId", () => {
    const context = createKnowledgeQueryContext({ tenantId: "tenant-1", traceId: "trace-1" });
    expect(context.traceId).toBe("trace-1");
  });

  it("defaults variables/metadata to empty objects", () => {
    const context = createKnowledgeQueryContext({ tenantId: "tenant-1" });
    expect(context.variables).toEqual({});
    expect(context.metadata).toEqual({});
  });

  it("carries through optional identity fields", () => {
    const context = createKnowledgeQueryContext({
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      departmentId: "department-1",
      organizationId: "org-1",
      solutionPackId: "pack-1",
      userId: "user-1",
      sessionId: "session-1",
      language: "en",
      environment: "test",
      permission: "read",
      policy: "retention",
    });
    expect(context.workspaceId).toBe("workspace-1");
    expect(context.departmentId).toBe("department-1");
    expect(context.organizationId).toBe("org-1");
    expect(context.solutionPackId).toBe("pack-1");
    expect(context.userId).toBe("user-1");
    expect(context.sessionId).toBe("session-1");
    expect(context.language).toBe("en");
    expect(context.environment).toBe("test");
    expect(context.permission).toBe("read");
    expect(context.policy).toBe("retention");
  });
});
