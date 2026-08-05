import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeRelationshipValidator } from "../../src/validator/runtime-relationship-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimeRelationshipValidator", () => {
  it("passes for a non-blank knowledgeId", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new RuntimeRelationshipValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails for a blank knowledgeId", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, instance: { ...execution.instance, knowledgeId: "  " } };
    expect(new RuntimeRelationshipValidator().validate({ execution: invalid }).valid).toBe(false);
  });
});
