import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { ContextValidator } from "../../src/validator/context-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — ContextValidator", () => {
  it("passes for a well-formed Context matching its Instance", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new ContextValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails for an empty tenantId", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, context: { ...execution.context, tenantId: "" } };
    const result = new ContextValidator().validate({ execution: invalid });
    expect(result.valid).toBe(false);
  });

  it("fails for an empty correlationId", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, context: { ...execution.context, correlationId: "" } };
    expect(new ContextValidator().validate({ execution: invalid }).valid).toBe(false);
  });

  it("fails when Context knowledgeId disagrees with Instance knowledgeId", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, context: { ...execution.context, knowledgeId: "k-other" } };
    const result = new ContextValidator().validate({ execution: invalid });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("context.knowledgeId");
  });
});
