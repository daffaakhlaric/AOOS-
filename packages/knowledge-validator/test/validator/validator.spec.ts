import { describe, expect, it } from "vitest";

import type { KnowledgeValidatorValidationInput } from "../../src/contracts/i-knowledge-validator-validator.js";
import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { AuditValidator } from "../../src/validator/audit-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { DecisionValidator } from "../../src/validator/decision-validator.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { IdentityValidator } from "../../src/validator/identity-validator.js";
import { IntegrityValidator } from "../../src/validator/integrity-validator.js";
import { KnowledgeValidatorValidator } from "../../src/validator/knowledge-validator-validator.js";
import { LifecycleValidator } from "../../src/validator/lifecycle-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { PolicyValidator } from "../../src/validator/policy-validator.js";
import { RuleValidator } from "../../src/validator/rule-validator.js";
import { StatisticsValidator } from "../../src/validator/statistics-validator.js";
import { ValidationValidator } from "../../src/validator/validation-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = "2026-01-01T00:00:00.000Z";

function validInput(
  overrides: Partial<KnowledgeValidatorValidationInput> = {},
): KnowledgeValidatorValidationInput {
  const context = contextFixture({ validationId: "v-1", tenantId: "t-1" });
  return {
    validation: {
      id: "v-1",
      token: context.token,
      validationId: "v-1",
      tenantId: "t-1",
      state: KnowledgeValidationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    metadata: {
      validationId: "v-1",
      title: "Title",
      tenantId: "t-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      validationId: "v-1",
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    context,
    ...overrides,
  };
}

describe("IdentityValidator", () => {
  const validator = new IdentityValidator();

  it("passes for a well-formed input", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank validationId", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      validation: { ...input.validation, validationId: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a metadata/validation validationId mismatch", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, validationId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a request/validation validationId mismatch", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      request: { ...input.request, validationId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed context token", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      context: { ...input.context, token: "not-a-token" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("MetadataValidator", () => {
  const validator = new MetadataValidator();

  it("passes for a well-formed input", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank title", () => {
    const input = validInput();
    const result = validator.validate({ ...input, metadata: { ...input.metadata, title: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a blank tenantId", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, tenantId: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed createdAt", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, createdAt: "not-a-date" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed updatedAt", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, updatedAt: "not-a-date" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("ValidationValidator (Stage 3 — checks Request well-formedness)", () => {
  const validator = new ValidationValidator();

  it("passes for a well-formed request", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank requestId", () => {
    const input = validInput();
    const result = validator.validate({ ...input, request: { ...input.request, requestId: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a blank requestedBy", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      request: { ...input.request, requestedBy: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank targetReference", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      request: { ...input.request, targetReference: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags an unknown category", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      request: { ...input.request, category: "unknown" as KnowledgeValidationCategory },
    });
    expect(result.valid).toBe(false);
  });
});

describe("RuleValidator", () => {
  const validator = new RuleValidator();

  it("passes when there are no declared rules", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("passes when rulesResolvable is true", () => {
    const input = validInput({
      request: { ...validInput().request, ruleIds: ["r-1"] },
      rulesResolvable: true,
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags a missing rule when rulesResolvable is false", () => {
    const input = validInput({
      request: { ...validInput().request, ruleIds: ["r-1"] },
      rulesResolvable: false,
      resolvedRules: [],
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("treats an undefined resolvedRules as no rules resolved", () => {
    const input = validInput({
      request: { ...validInput().request, ruleIds: ["r-1"] },
      rulesResolvable: false,
      resolvedRules: undefined,
    });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("PolicyValidator", () => {
  const validator = new PolicyValidator();

  it("passes when no policy is declared", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("flags a declared policyId that does not resolve", () => {
    const input = validInput({ request: { ...validInput().request, policyId: "p-1" } });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("passes when the resolved policy allows the category", () => {
    const input = validInput({
      request: { ...validInput().request, policyId: "p-1" },
      policy: {
        id: "p-1",
        policyId: "p-1",
        name: "Policy",
        tenantId: "t-1",
        allowedCategories: [],
        requireApproval: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags when the resolved policy is inactive", () => {
    const input = validInput({
      request: { ...validInput().request, policyId: "p-1" },
      policy: {
        id: "p-1",
        policyId: "p-1",
        name: "Policy",
        tenantId: "t-1",
        allowedCategories: [],
        requireApproval: false,
        active: false,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("DecisionValidator", () => {
  const validator = new DecisionValidator();

  it("passes when no decision is present (documented no-op)", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("passes for a legal decision value", () => {
    const input = validInput({
      decision: {
        id: "d-1",
        decisionId: "d-1",
        validationId: "v-1",
        tenantId: "t-1",
        value: KnowledgeValidationDecisionValue.APPROVED,
        reportedBy: "user-1",
        recordedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags an unknown decision value", () => {
    const input = validInput({
      decision: {
        id: "d-1",
        decisionId: "d-1",
        validationId: "v-1",
        tenantId: "t-1",
        value: "unknown" as KnowledgeValidationDecisionValue,
        reportedBy: "user-1",
        recordedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("flags an out-of-range confidence", () => {
    const input = validInput({
      decision: {
        id: "d-1",
        decisionId: "d-1",
        validationId: "v-1",
        tenantId: "t-1",
        value: KnowledgeValidationDecisionValue.APPROVED,
        reportedBy: "user-1",
        confidence: 1.5,
        recordedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("ConfigurationValidator", () => {
  const validator = new ConfigurationValidator();

  it("passes when no configuration is present", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("flags a non-positive timeoutMs", () => {
    const input = validInput({
      configuration: {
        id: "c-1",
        configurationId: "c-1",
        validationId: "v-1",
        tenantId: "t-1",
        timeoutMs: 0,
        custom: {},
        createdAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("flags an out-of-range retries", () => {
    const input = validInput({
      configuration: {
        id: "c-1",
        configurationId: "c-1",
        validationId: "v-1",
        tenantId: "t-1",
        retries: 11,
        custom: {},
        createdAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("flags a non-positive maxFindings", () => {
    const input = validInput({
      configuration: {
        id: "c-1",
        configurationId: "c-1",
        validationId: "v-1",
        tenantId: "t-1",
        maxFindings: 0,
        custom: {},
        createdAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("passes for a well-formed configuration", () => {
    const input = validInput({
      configuration: {
        id: "c-1",
        configurationId: "c-1",
        validationId: "v-1",
        tenantId: "t-1",
        timeoutMs: 1000,
        retries: 3,
        maxFindings: 10,
        custom: {},
        createdAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(true);
  });
});

describe("LifecycleValidator", () => {
  const validator = new LifecycleValidator();

  it("passes when no target state is supplied", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("passes for a legal transition", () => {
    const input = validInput({
      currentState: KnowledgeValidationState.DRAFT,
      targetState: KnowledgeValidationState.QUEUED,
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags an illegal transition", () => {
    const input = validInput({
      currentState: KnowledgeValidationState.DRAFT,
      targetState: KnowledgeValidationState.APPROVED,
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("passes when current and target states are equal", () => {
    const input = validInput({
      currentState: KnowledgeValidationState.DRAFT,
      targetState: KnowledgeValidationState.DRAFT,
    });
    expect(validator.validate(input).valid).toBe(true);
  });
});

describe("DependencyValidator", () => {
  const validator = new DependencyValidator();

  it("passes for Custom Validation with no rules", () => {
    const input = validInput({
      request: {
        ...validInput().request,
        category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
        ruleIds: [],
      },
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags a non-Custom category with no rules", () => {
    const input = validInput({
      request: {
        ...validInput().request,
        category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
        ruleIds: [],
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("passes a non-Custom category with at least one rule", () => {
    const input = validInput({
      request: {
        ...validInput().request,
        category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
        ruleIds: ["r-1"],
      },
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags a Policy requiring approval with no Configuration", () => {
    const input = validInput({
      request: { ...validInput().request, ruleIds: ["r-1"], policyId: "p-1" },
      policy: {
        id: "p-1",
        policyId: "p-1",
        name: "Policy",
        tenantId: "t-1",
        allowedCategories: [],
        requireApproval: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("passes a Policy requiring approval when a Configuration is present", () => {
    const input = validInput({
      request: { ...validInput().request, ruleIds: ["r-1"], policyId: "p-1" },
      policy: {
        id: "p-1",
        policyId: "p-1",
        name: "Policy",
        tenantId: "t-1",
        allowedCategories: [],
        requireApproval: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      configuration: {
        id: "c-1",
        configurationId: "c-1",
        validationId: "v-1",
        tenantId: "t-1",
        custom: {},
        createdAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(true);
  });
});

describe("StatisticsValidator", () => {
  const validator = new StatisticsValidator();

  it("passes when no snapshot is supplied", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("passes for a well-formed snapshot", () => {
    const input = validInput({
      statisticsSnapshot: { requestedCount: 5, approvedCount: 2, rejectedCount: 1 },
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags a negative requestedCount", () => {
    const input = validInput({
      statisticsSnapshot: { requestedCount: -1, approvedCount: 0, rejectedCount: 0 },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("flags a negative approvedCount", () => {
    const input = validInput({
      statisticsSnapshot: { requestedCount: 1, approvedCount: -1, rejectedCount: 0 },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("flags a negative rejectedCount", () => {
    const input = validInput({
      statisticsSnapshot: { requestedCount: 1, approvedCount: 0, rejectedCount: -1 },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("flags approved+rejected exceeding requested", () => {
    const input = validInput({
      statisticsSnapshot: { requestedCount: 1, approvedCount: 1, rejectedCount: 1 },
    });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("IntegrityValidator", () => {
  const validator = new IntegrityValidator();

  it("passes when tenantId agrees across context/metadata", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("flags a context/metadata tenantId mismatch", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      context: { ...input.context, tenantId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a policy tenantId mismatch", () => {
    const input = validInput({
      policy: {
        id: "p-1",
        policyId: "p-1",
        name: "Policy",
        tenantId: "other",
        allowedCategories: [],
        requireApproval: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("passes when policy tenantId agrees", () => {
    const input = validInput({
      policy: {
        id: "p-1",
        policyId: "p-1",
        name: "Policy",
        tenantId: "t-1",
        allowedCategories: [],
        requireApproval: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(validator.validate(input).valid).toBe(true);
  });
});

describe("AuditValidator", () => {
  const validator = new AuditValidator();

  it("passes for a well-formed input", () => {
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank requestedBy", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      request: { ...input.request, requestedBy: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed createdAt", () => {
    const input = validInput();
    const result = validator.validate({
      ...input,
      request: { ...input.request, createdAt: "not-a-date" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("KnowledgeValidatorValidator (12-stage aggregator)", () => {
  it("runs exactly 12 stages in the specified order", () => {
    const validator = new KnowledgeValidatorValidator();
    expect(validator.stageNames).toEqual([
      "identity",
      "metadata",
      "validation",
      "rule",
      "policy",
      "decision",
      "configuration",
      "lifecycle",
      "dependency",
      "statistics",
      "integrity",
      "audit",
    ]);
  });

  it("passes for a fully well-formed input", () => {
    const validator = new KnowledgeValidatorValidator();
    const input = validInput();
    expect(
      validator.validate({ ...input, request: { ...input.request, ruleIds: ["r-1"] } }).valid,
    ).toBe(true);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const validator = new KnowledgeValidatorValidator();
    const input = validInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, title: "" },
      request: { ...input.request, requestId: "" },
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("supports extraStages", () => {
    const validator = new KnowledgeValidatorValidator({
      extraStages: [
        {
          name: "custom",
          validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
        },
      ],
    });
    expect(validator.stageNames).toContain("custom");
    expect(validator.validate(validInput()).valid).toBe(false);
  });
});
