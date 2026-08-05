import { describe, expect, it } from "vitest";

import { createKnowledgeSourceContext } from "../../src/context/create-knowledge-source-context.js";

describe("createKnowledgeSourceContext additional coverage", () => {
  it("propagates organizationId/departmentId/environment when supplied", () => {
    const context = createKnowledgeSourceContext({
      sourceId: "s-1",
      providerId: "p-1",
      tenantId: "t-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      environment: "production",
    });
    expect(context.organizationId).toBe("org-1");
    expect(context.departmentId).toBe("dept-1");
    expect(context.environment).toBe("production");
  });

  it("propagates namespace/policy/permission when supplied", () => {
    const context = createKnowledgeSourceContext({
      sourceId: "s-1",
      providerId: "p-1",
      tenantId: "t-1",
      namespace: "ns-1",
      policy: "policy-1",
      permission: "perm-1",
    });
    expect(context.namespace).toBe("ns-1");
    expect(context.policy).toBe("policy-1");
    expect(context.permission).toBe("perm-1");
  });

  it("preserves caller-supplied metadata contents", () => {
    const context = createKnowledgeSourceContext({
      sourceId: "s-1",
      providerId: "p-1",
      tenantId: "t-1",
      metadata: { requestId: "req-1" },
    });
    expect(context.metadata).toEqual({ requestId: "req-1" });
  });
});
