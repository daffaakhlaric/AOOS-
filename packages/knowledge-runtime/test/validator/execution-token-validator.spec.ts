import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { ExecutionTokenValidator } from "../../src/validator/execution-token-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — ExecutionTokenValidator", () => {
  it("passes for a valid KnowledgeRuntimeToken", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new ExecutionTokenValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails for a malformed token", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, instance: { ...execution.instance, token: "not-a-token" } };
    expect(new ExecutionTokenValidator().validate({ execution: invalid }).valid).toBe(false);
  });
});
