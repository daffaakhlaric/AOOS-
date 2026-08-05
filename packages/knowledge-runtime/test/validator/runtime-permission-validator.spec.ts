import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimePermissionValidator } from "../../src/validator/runtime-permission-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimePermissionValidator", () => {
  it("passes when context.permission is unset", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new RuntimePermissionValidator().validate({ execution }).valid).toBe(true);
  });

  it("passes when context.permission is a non-blank string", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      permission: "perm-1",
    });
    expect(new RuntimePermissionValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails when context.permission is blank", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, context: { ...execution.context, permission: "  " } };
    expect(new RuntimePermissionValidator().validate({ execution: invalid }).valid).toBe(false);
  });
});
