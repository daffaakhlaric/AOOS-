import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimePolicyValidator } from "../../src/validator/runtime-policy-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimePolicyValidator", () => {
  it("passes when context.policy is unset", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new RuntimePolicyValidator().validate({ execution }).valid).toBe(true);
  });

  it("passes when context.policy is a non-blank string", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      policy: "policy-1",
    });
    expect(new RuntimePolicyValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails when context.policy is blank", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, context: { ...execution.context, policy: "  " } };
    expect(new RuntimePolicyValidator().validate({ execution: invalid }).valid).toBe(false);
  });
});
