import { describe, expect, it } from "vitest";

import { createKnowledgeValidatorContext } from "../../src/context/create-knowledge-validator-context.js";
import { knowledgeValidatorContextSchema } from "../../src/context/knowledge-validator-context.js";

describe("createKnowledgeValidatorContext", () => {
  it("generates a token when none is supplied", () => {
    const context = createKnowledgeValidatorContext({ validationId: "v-1", tenantId: "t-1" });
    expect(context.token).toMatch(/^kval_/);
  });

  it("uses the supplied token when provided", () => {
    const context = createKnowledgeValidatorContext({
      validationId: "v-1",
      tenantId: "t-1",
      token: "kval_custom",
    });
    expect(context.token).toBe("kval_custom");
  });

  it("generates a correlationId when none is supplied", () => {
    const context = createKnowledgeValidatorContext({ validationId: "v-1", tenantId: "t-1" });
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("uses the supplied correlationId when provided", () => {
    const context = createKnowledgeValidatorContext({
      validationId: "v-1",
      tenantId: "t-1",
      correlationId: "corr-1",
    });
    expect(context.correlationId).toBe("corr-1");
  });

  it("copies optional fields through", () => {
    const context = createKnowledgeValidatorContext({
      validationId: "v-1",
      tenantId: "t-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      departmentId: "dept-1",
      environment: "prod",
      namespace: "ns-1",
      traceId: "trace-1",
      metadata: { a: 1 },
    });
    expect(context.organizationId).toBe("org-1");
    expect(context.workspaceId).toBe("ws-1");
    expect(context.departmentId).toBe("dept-1");
    expect(context.environment).toBe("prod");
    expect(context.namespace).toBe("ns-1");
    expect(context.traceId).toBe("trace-1");
    expect(context.metadata).toEqual({ a: 1 });
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeValidatorContext({ validationId: "v-1", tenantId: "t-1" });
    expect(context.metadata).toEqual({});
  });

  it("carries validationId/tenantId through", () => {
    const context = createKnowledgeValidatorContext({ validationId: "v-1", tenantId: "t-1" });
    expect(context.validationId).toBe("v-1");
    expect(context.tenantId).toBe("t-1");
  });

  it("produces output that satisfies the zod schema", () => {
    const context = createKnowledgeValidatorContext({ validationId: "v-1", tenantId: "t-1" });
    expect(() => knowledgeValidatorContextSchema.parse(context)).not.toThrow();
  });

  it("rejects a schema-invalid context (blank tenantId)", () => {
    const context = createKnowledgeValidatorContext({ validationId: "v-1", tenantId: "t-1" });
    expect(() => knowledgeValidatorContextSchema.parse({ ...context, tenantId: "" })).toThrow();
  });
});
