import { describe, expect, it } from "vitest";

import { createKnowledgeGeneratorContext } from "../../src/context/create-knowledge-generator-context.js";
import { knowledgeGeneratorContextSchema } from "../../src/context/knowledge-generator-context.js";
import { isKnowledgeGeneratorToken } from "../../src/token/knowledge-generator-token.js";

describe("createKnowledgeGeneratorContext", () => {
  it("generates a well-formed token when none supplied", () => {
    const context = createKnowledgeGeneratorContext({
      generationId: "g-1",
      tenantId: "tenant-1",
    });
    expect(isKnowledgeGeneratorToken(context.token)).toBe(true);
  });

  it("generates a correlationId when none supplied", () => {
    const context = createKnowledgeGeneratorContext({
      generationId: "g-1",
      tenantId: "tenant-1",
    });
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("honors a caller-supplied token/correlationId", () => {
    const context = createKnowledgeGeneratorContext({
      generationId: "g-1",
      tenantId: "tenant-1",
      token: "kgen_custom",
      correlationId: "corr-custom",
    });
    expect(context.token).toBe("kgen_custom");
    expect(context.correlationId).toBe("corr-custom");
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeGeneratorContext({ generationId: "g-1", tenantId: "tenant-1" });
    expect(context.metadata).toEqual({});
  });

  it("passes through optional scoping fields", () => {
    const context = createKnowledgeGeneratorContext({
      generationId: "g-1",
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
    const context = createKnowledgeGeneratorContext({ generationId: "g-1", tenantId: "tenant-1" });
    expect(() => knowledgeGeneratorContextSchema.parse(context)).not.toThrow();
  });
});

describe("knowledgeGeneratorContextSchema", () => {
  it("rejects a blank tenantId", () => {
    const context = createKnowledgeGeneratorContext({ generationId: "g-1", tenantId: "tenant-1" });
    expect(() => knowledgeGeneratorContextSchema.parse({ ...context, tenantId: "" })).toThrow();
  });
});
