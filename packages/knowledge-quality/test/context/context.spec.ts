import { describe, expect, it } from "vitest";

import { createKnowledgeQualityContext } from "../../src/context/create-knowledge-quality-context.js";
import { knowledgeQualityContextSchema } from "../../src/context/knowledge-quality-context.js";
import { isKnowledgeQualityToken } from "../../src/token/knowledge-quality-token.js";

describe("createKnowledgeQualityContext", () => {
  it("assesses a well-formed token when none supplied", () => {
    const context = createKnowledgeQualityContext({
      assessmentId: "g-1",
      tenantId: "tenant-1",
    });
    expect(isKnowledgeQualityToken(context.token)).toBe(true);
  });

  it("assesses a correlationId when none supplied", () => {
    const context = createKnowledgeQualityContext({
      assessmentId: "g-1",
      tenantId: "tenant-1",
    });
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("honors a caller-supplied token/correlationId", () => {
    const context = createKnowledgeQualityContext({
      assessmentId: "g-1",
      tenantId: "tenant-1",
      token: "kqua_custom",
      correlationId: "corr-custom",
    });
    expect(context.token).toBe("kqua_custom");
    expect(context.correlationId).toBe("corr-custom");
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeQualityContext({ assessmentId: "g-1", tenantId: "tenant-1" });
    expect(context.metadata).toEqual({});
  });

  it("passes through optional scoping fields", () => {
    const context = createKnowledgeQualityContext({
      assessmentId: "g-1",
      tenantId: "tenant-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      departmentId: "dept-1",
      environment: "production",
      namespace: "ns-1",
      traceId: "trace-1",
    });
    expect(context.organizationId).toBe("org-1");
    expect(context.workspaceId).toBe("ws-1");
    expect(context.departmentId).toBe("dept-1");
    expect(context.environment).toBe("production");
    expect(context.namespace).toBe("ns-1");
    expect(context.traceId).toBe("trace-1");
  });

  it("produces a schema-valid context", () => {
    const context = createKnowledgeQualityContext({ assessmentId: "g-1", tenantId: "tenant-1" });
    expect(() => knowledgeQualityContextSchema.parse(context)).not.toThrow();
  });
});

describe("knowledgeQualityContextSchema", () => {
  it("rejects a blank tenantId", () => {
    const context = createKnowledgeQualityContext({ assessmentId: "g-1", tenantId: "tenant-1" });
    expect(() => knowledgeQualityContextSchema.parse({ ...context, tenantId: "" })).toThrow();
  });
});
