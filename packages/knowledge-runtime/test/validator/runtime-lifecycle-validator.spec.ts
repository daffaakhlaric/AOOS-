import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeLifecycleValidator } from "../../src/validator/runtime-lifecycle-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimeLifecycleValidator", () => {
  it("passes for a non-DESTROYED Instance", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new RuntimeLifecycleValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails for a DESTROYED Instance", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const destroyed = {
      ...execution,
      instance: { ...execution.instance, state: KnowledgeRuntimeState.DESTROYED },
    };
    const result = new RuntimeLifecycleValidator().validate({ execution: destroyed });
    expect(result.valid).toBe(false);
  });
});
