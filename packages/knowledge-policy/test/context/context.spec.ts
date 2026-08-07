import { describe, expect, it } from "vitest";

import { createKnowledgePolicyContext } from "../../src/context/create-knowledge-policy-context.js";
import { knowledgePolicyContextSchema } from "../../src/context/knowledge-policy-context.js";
import { isKnowledgePolicyToken } from "../../src/token/knowledge-policy-token.js";

describe("createKnowledgePolicyContext", () => {
  it("generates a token and correlationId when not supplied", () => {
    const context = createKnowledgePolicyContext({ policyId: "policy-1", tenantId: "tenant-1" });
    expect(isKnowledgePolicyToken(context.token)).toBe(true);
    expect(context.correlationId.length).toBeGreaterThan(0);
    expect(context.policyId).toBe("policy-1");
    expect(context.tenantId).toBe("tenant-1");
    expect(context.metadata).toEqual({});
  });

  it("uses a supplied token and correlationId", () => {
    const context = createKnowledgePolicyContext({
      policyId: "policy-1",
      tenantId: "tenant-1",
      token: "kpol_fixed",
      correlationId: "corr-fixed",
    });
    expect(context.token).toBe("kpol_fixed");
    expect(context.correlationId).toBe("corr-fixed");
  });

  it("copies optional fields through", () => {
    const context = createKnowledgePolicyContext({
      policyId: "policy-1",
      tenantId: "tenant-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      departmentId: "dept-1",
      environment: "production",
      namespace: "ns-1",
      metadata: { foo: "bar" },
      traceId: "trace-1",
    });
    expect(context.organizationId).toBe("org-1");
    expect(context.workspaceId).toBe("workspace-1");
    expect(context.departmentId).toBe("dept-1");
    expect(context.environment).toBe("production");
    expect(context.namespace).toBe("ns-1");
    expect(context.metadata).toEqual({ foo: "bar" });
    expect(context.traceId).toBe("trace-1");
  });

  it("produces a context that validates against knowledgePolicyContextSchema", () => {
    const context = createKnowledgePolicyContext({ policyId: "policy-1", tenantId: "tenant-1" });
    expect(knowledgePolicyContextSchema.safeParse(context).success).toBe(true);
  });
});

describe("knowledgePolicyContextSchema", () => {
  it("rejects a context missing tenantId", () => {
    const result = knowledgePolicyContextSchema.safeParse({
      token: "kpol_x",
      policyId: "policy-1",
      metadata: {},
      correlationId: "corr-1",
    });
    expect(result.success).toBe(false);
  });
});
