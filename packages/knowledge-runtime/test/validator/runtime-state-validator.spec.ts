import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeStateValidator } from "../../src/validator/runtime-state-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimeStateValidator", () => {
  it("passes for a valid state", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new RuntimeStateValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails for an unknown state", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, instance: { ...execution.instance, state: "bogus" as never } };
    const result = new RuntimeStateValidator().validate({ execution: invalid });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("instance.state");
  });
});
