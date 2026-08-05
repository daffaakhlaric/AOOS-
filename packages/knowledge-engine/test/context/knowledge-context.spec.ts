import { createExecutionToken } from "@aos/workflow-execution";
import { describe, expect, it } from "vitest";

import { createKnowledgeContext } from "../../src/context/create-knowledge-context.js";
import { knowledgeContextSchema } from "../../src/context/knowledge-context.js";

describe("Context Test — createKnowledgeContext", () => {
  it("derives correlationId/traceId straight from the ExecutionToken", () => {
    const token = createExecutionToken({
      workflowInstanceId: "wf-instance-1",
      correlationId: "corr-1",
      traceId: "trace-1",
    });
    const context = createKnowledgeContext({ token, tenantId: "tenant-1" });
    expect(context.correlationId).toBe("corr-1");
    expect(context.traceId).toBe("trace-1");
    expect(context.tenantId).toBe("tenant-1");
  });

  it("defaults metadata/variables/permissions/policies/labels/tags to independent empty collections", () => {
    const tokenA = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    const tokenB = createExecutionToken({ workflowInstanceId: "wf-instance-2" });
    const a = createKnowledgeContext({ token: tokenA, tenantId: "t1" });
    const b = createKnowledgeContext({ token: tokenB, tenantId: "t1" });
    a.metadata["mutated"] = true;
    expect(b.metadata).toEqual({});
    expect(a.permissions).toEqual([]);
    expect(a.policies).toEqual([]);
    expect(a.labels).toEqual([]);
    expect(a.tags).toEqual([]);
  });

  it("carries through optional scope/user/environment/language fields", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    const context = createKnowledgeContext({
      token,
      tenantId: "t1",
      workspaceId: "w1",
      organizationId: "org-1",
      departmentId: "dept-1",
      userId: "user-1",
      environment: "production",
      language: "en",
      permissions: ["perm-1"],
      policies: ["policy-1"],
      labels: ["label-1"],
      tags: ["tag-1"],
      variables: { count: 1 },
    });
    expect(context.workspaceId).toBe("w1");
    expect(context.organizationId).toBe("org-1");
    expect(context.departmentId).toBe("dept-1");
    expect(context.userId).toBe("user-1");
    expect(context.environment).toBe("production");
    expect(context.language).toBe("en");
    expect(context.permissions).toEqual(["perm-1"]);
    expect(context.policies).toEqual(["policy-1"]);
    expect(context.labels).toEqual(["label-1"]);
    expect(context.tags).toEqual(["tag-1"]);
    expect(context.variables).toEqual({ count: 1 });
  });

  it("knowledgeContextSchema accepts a Context built via the factory", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    const context = createKnowledgeContext({ token, tenantId: "t1" });
    expect(knowledgeContextSchema.safeParse(context).success).toBe(true);
  });

  it("knowledgeContextSchema rejects a Context missing tenantId", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    const context = createKnowledgeContext({ token, tenantId: "t1" });
    const { tenantId: _tenantId, ...rest } = context;
    expect(knowledgeContextSchema.safeParse(rest).success).toBe(false);
  });
});
