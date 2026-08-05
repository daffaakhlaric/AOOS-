import { describe, expect, it } from "vitest";

import { createKnowledgeSynchronizationContext } from "../../src/context/create-knowledge-synchronization-context.js";
import { KnowledgeSynchronizationProviderType } from "../../src/domain/knowledge-synchronization-provider-type.js";
import { isKnowledgeSynchronizationToken } from "../../src/token/knowledge-synchronization-token.js";

function baseInput() {
  return {
    tenantId: "tenant-1",
    providerId: "provider-1",
    sourceId: "source-1",
    sourceType: KnowledgeSynchronizationProviderType.DOCUMENT,
  };
}

describe("createKnowledgeSynchronizationContext", () => {
  it("generates a synchronizationId, token, and correlationId when omitted", () => {
    const context = createKnowledgeSynchronizationContext(baseInput());
    expect(context.synchronizationId.length).toBeGreaterThan(0);
    expect(isKnowledgeSynchronizationToken(context.token)).toBe(true);
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("preserves caller-supplied ids", () => {
    const context = createKnowledgeSynchronizationContext({
      ...baseInput(),
      synchronizationId: "sync-1",
      token: "stok_fixed",
      correlationId: "corr-fixed",
    });
    expect(context.synchronizationId).toBe("sync-1");
    expect(context.token).toBe("stok_fixed");
    expect(context.correlationId).toBe("corr-fixed");
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeSynchronizationContext(baseInput());
    expect(context.metadata).toEqual({});
  });

  it("carries through optional identity fields", () => {
    const context = createKnowledgeSynchronizationContext({
      ...baseInput(),
      workspaceId: "workspace-1",
      organizationId: "org-1",
      departmentId: "department-1",
      collection: "collection-1",
      namespace: "ns",
      version: "1.0.0",
      policy: "policy-1",
      permission: "read",
      environment: "test",
      traceId: "trace-1",
    });
    expect(context.workspaceId).toBe("workspace-1");
    expect(context.organizationId).toBe("org-1");
    expect(context.departmentId).toBe("department-1");
    expect(context.collection).toBe("collection-1");
    expect(context.namespace).toBe("ns");
    expect(context.version).toBe("1.0.0");
    expect(context.policy).toBe("policy-1");
    expect(context.permission).toBe("read");
    expect(context.environment).toBe("test");
    expect(context.traceId).toBe("trace-1");
  });
});
