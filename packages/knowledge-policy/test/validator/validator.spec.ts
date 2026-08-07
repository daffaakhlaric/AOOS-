import { describe, expect, it } from "vitest";

import type { KnowledgePolicyValidationInput } from "../../src/contracts/i-knowledge-policy-validator.js";
import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";
import type { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { AssignmentValidator } from "../../src/validator/assignment-validator.js";
import { ConditionsValidator } from "../../src/validator/conditions-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { IdentityValidator } from "../../src/validator/identity-validator.js";
import { IntegrityValidator } from "../../src/validator/integrity-validator.js";
import { KnowledgePolicyValidator } from "../../src/validator/knowledge-policy-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { PolicyTypeValidator } from "../../src/validator/policy-type-validator.js";
import { RulesValidator } from "../../src/validator/rules-validator.js";
import { ScopeValidator } from "../../src/validator/scope-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function baseInput(): KnowledgePolicyValidationInput {
  return {
    metadata: metadataFixture(),
    context: contextFixture(),
    configuration: configurationFixture(),
  };
}

describe("IdentityValidator", () => {
  const validator = new IdentityValidator();

  it("passes for a coherent metadata/context pair", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a blank policyId", () => {
    const input = baseInput();
    const result = validator.validate({ ...input, metadata: { ...input.metadata, policyId: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a mismatched policyId between metadata and context", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      context: { ...input.context, policyId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed context token", () => {
    const input = baseInput();
    const result = validator.validate({ ...input, context: { ...input.context, token: "bad" } });
    expect(result.valid).toBe(false);
  });
});

describe("MetadataValidator", () => {
  const validator = new MetadataValidator();

  it("passes for valid metadata", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a blank policyName", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, policyName: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank tenantId", () => {
    const input = baseInput();
    const result = validator.validate({ ...input, metadata: { ...input.metadata, tenantId: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a negative priority", () => {
    const input = baseInput();
    const result = validator.validate({ ...input, metadata: { ...input.metadata, priority: -1 } });
    expect(result.valid).toBe(false);
  });
});

describe("ScopeValidator", () => {
  const validator = new ScopeValidator();

  it("passes for a valid context tenant", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a blank context tenantId", () => {
    const input = baseInput();
    const result = validator.validate({ ...input, context: { ...input.context, tenantId: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a tenant mismatch between metadata and context", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      context: { ...input.context, tenantId: "other-tenant" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("RulesValidator", () => {
  const validator = new RulesValidator();

  it("passes when ruleCount is not supplied", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("passes when ruleCount is within maxRules", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, maxRules: 5 },
      ruleCount: 3,
    });
    expect(result.valid).toBe(true);
  });

  it("flags ruleCount exceeding maxRules", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, maxRules: 2 },
      ruleCount: 3,
    });
    expect(result.valid).toBe(false);
  });
});

describe("ConditionsValidator", () => {
  const validator = new ConditionsValidator();

  it("passes for a non-blank correlationId", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a blank correlationId", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      context: { ...input.context, correlationId: "" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("AssignmentValidator", () => {
  const validator = new AssignmentValidator();

  it("passes when assignmentCount is not supplied", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("passes when assignmentCount is within maxAssignments", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, maxAssignments: 5 },
      assignmentCount: 3,
    });
    expect(result.valid).toBe(true);
  });

  it("flags assignmentCount exceeding maxAssignments", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, maxAssignments: 2 },
      assignmentCount: 3,
    });
    expect(result.valid).toBe(false);
  });
});

describe("PolicyTypeValidator", () => {
  const validator = new PolicyTypeValidator();

  it("passes for a valid policy type", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags an invalid policy type", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, policyType: "bogus" as KnowledgePolicyType },
    });
    expect(result.valid).toBe(false);
  });
});

describe("ConfigurationValidator", () => {
  const validator = new ConfigurationValidator();

  it("passes a valid configuration", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a configuration/metadata policyId mismatch", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, policyId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags maxRules below 1", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, maxRules: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags maxAssignments below 1", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, maxAssignments: 0 },
    });
    expect(result.valid).toBe(false);
  });
});

describe("DependencyValidator", () => {
  const validator = new DependencyValidator();

  it("passes when knownPolicyIds is not supplied", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("passes a unique policyId in knownPolicyIds", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      knownPolicyIds: [input.metadata.policyId],
    });
    expect(result.valid).toBe(true);
  });

  it("flags a duplicated policyId in knownPolicyIds", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      knownPolicyIds: [input.metadata.policyId, input.metadata.policyId],
    });
    expect(result.valid).toBe(false);
  });
});

describe("IntegrityValidator", () => {
  const validator = new IntegrityValidator();

  it("passes when no currentState/targetState is supplied", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("passes a legal lifecycle transition", () => {
    const result = validator.validate({
      ...baseInput(),
      currentState: KnowledgePolicyState.DRAFT,
      targetState: KnowledgePolicyState.CREATED,
    });
    expect(result.valid).toBe(true);
  });

  it("flags an illegal lifecycle transition", () => {
    const result = validator.validate({
      ...baseInput(),
      currentState: KnowledgePolicyState.DRAFT,
      targetState: KnowledgePolicyState.ACTIVE,
    });
    expect(result.valid).toBe(false);
  });

  it("flags createdAt after updatedAt", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: {
        ...input.metadata,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(result.valid).toBe(false);
  });
});

describe("KnowledgePolicyValidator", () => {
  it("runs all 10 built-in stages in the exact prompt order", () => {
    const validator = new KnowledgePolicyValidator();
    expect(validator.stageNames).toEqual([
      "identity",
      "metadata",
      "scope",
      "rules",
      "conditions",
      "assignment",
      "policyType",
      "configuration",
      "dependency",
      "integrity",
    ]);
  });

  it("passes a fully valid input", () => {
    const validator = new KnowledgePolicyValidator();
    const result = validator.validate(baseInput());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues across multiple failing stages without short-circuiting", () => {
    const validator = new KnowledgePolicyValidator();
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, policyId: "", policyName: "" },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it("runs caller-supplied extraStages alongside the 10 built-in stages", () => {
    const extraStage = {
      name: "custom",
      validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
    };
    const validator = new KnowledgePolicyValidator({ extraStages: [extraStage] });
    expect(validator.stageNames).toContain("custom");
    expect(validator.validate(baseInput()).valid).toBe(false);
  });
});
