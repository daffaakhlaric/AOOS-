import { describe, expect, it } from "vitest";

import { createKnowledgeVersionContext } from "../../src/context/create-knowledge-version-context.js";
import { knowledgeVersionContextSchema } from "../../src/context/knowledge-version-context.js";
import { isKnowledgeVersionToken } from "../../src/token/knowledge-version-token.js";

describe("createKnowledgeVersionContext", () => {
  it("generates a token and correlationId when not supplied", () => {
    const context = createKnowledgeVersionContext({
      versionId: "v1",
      assetId: "a1",
      tenantId: "tenant-1",
    });
    expect(isKnowledgeVersionToken(context.token)).toBe(true);
    expect(context.correlationId).toBeTruthy();
    expect(knowledgeVersionContextSchema.parse(context)).toEqual(context);
  });

  it("honors caller-supplied token/correlationId/metadata", () => {
    const context = createKnowledgeVersionContext({
      token: "kver_explicit",
      versionId: "v1",
      assetId: "a1",
      branchId: "b1",
      workspaceId: "w1",
      tenantId: "tenant-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      environment: "prod",
      namespace: "ns-1",
      policy: "policy-1",
      permission: "perm-1",
      metadata: { key: "value" },
      traceId: "trace-1",
      correlationId: "corr-1",
    });
    expect(context.token).toBe("kver_explicit");
    expect(context.correlationId).toBe("corr-1");
    expect(context.metadata).toEqual({ key: "value" });
    expect(context.branchId).toBe("b1");
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeVersionContext({
      versionId: "v1",
      assetId: "a1",
      tenantId: "tenant-1",
    });
    expect(context.metadata).toEqual({});
  });
});
