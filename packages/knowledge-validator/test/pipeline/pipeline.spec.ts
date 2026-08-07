import { describe, expect, it, vi } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import type { KnowledgeValidationExecution } from "../../src/domain/knowledge-validation-execution.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { ValidationCheckException } from "../../src/errors/validation-check-exception.js";
import { ValidatorConfigurationException } from "../../src/errors/validator-configuration-exception.js";
import { ValidatorDecisionException } from "../../src/errors/validator-decision-exception.js";
import { ValidatorPolicyException } from "../../src/errors/validator-policy-exception.js";
import { ValidatorRuleException } from "../../src/errors/validator-rule-exception.js";
import { KnowledgeValidatorMetrics } from "../../src/metrics/knowledge-validator-metrics.js";
import { KnowledgeValidatorPipeline } from "../../src/pipeline/knowledge-validator-pipeline.js";
import { KnowledgeValidatorRegistryBucket } from "../../src/registry/knowledge-validator-registry-bucket.js";
import { KnowledgeValidatorRegistry } from "../../src/registry/knowledge-validator-registry.js";
import { KnowledgeValidatorResolver } from "../../src/resolver/knowledge-validator-resolver.js";
import { KnowledgeValidatorValidator } from "../../src/validator/knowledge-validator-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = "2026-01-01T00:00:00.000Z";

function buildExecution(
  overrides: Partial<KnowledgeValidationExecution["request"]> = {},
): KnowledgeValidationExecution {
  const context = contextFixture({ validationId: "v-1", tenantId: "t-1" });
  return {
    instance: {
      id: "v-1",
      token: context.token,
      validationId: "v-1",
      tenantId: "t-1",
      state: KnowledgeValidationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context,
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
      ...overrides,
    },
    resolvedRules: [],
    findings: [],
    resultMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

function buildPipeline() {
  const registry = new KnowledgeValidatorRegistry();
  const resolver = new KnowledgeValidatorResolver(registry);
  const metrics = new KnowledgeValidatorMetrics();
  const pipeline = new KnowledgeValidatorPipeline(
    new KnowledgeValidatorValidator(),
    metrics,
    registry,
    resolver,
  );
  return { pipeline, registry, resolver, metrics };
}

describe("KnowledgeValidatorPipeline", () => {
  it("runs successfully for a well-formed create operation", () => {
    const { pipeline } = buildPipeline();
    const result = pipeline.run({
      execution: buildExecution({
        ruleIds: [],
        category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      }),
      operation: "create_validation",
      targetState: KnowledgeValidationState.DRAFT,
    });
    expect(result.instance.state).toBe(KnowledgeValidationState.DRAFT);
  });

  it("throws ValidationCheckException when the 12-stage Validator fails", () => {
    const { pipeline } = buildPipeline();
    const execution = buildExecution({ requestedBy: "" });
    expect(() =>
      pipeline.run({ execution, operation: "create_validation", targetState: undefined }),
    ).toThrow(ValidationCheckException);
  });

  it("records a check outcome on the metrics collector", () => {
    const { pipeline, metrics } = buildPipeline();
    pipeline.run({
      execution: buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION }),
      operation: "create_validation",
    });
    expect(metrics.snapshot().checkCount).toBe(1);
  });

  it("throws ValidatorRuleException when a declared rule does not resolve (Stage 2, bypassing Stage 1's own Rule check)", () => {
    const { pipeline } = buildPipeline();
    vi.spyOn(KnowledgeValidatorValidator.prototype, "validate").mockReturnValueOnce({
      valid: true,
      issues: [],
    });
    const execution = buildExecution({ ruleIds: ["missing-rule"] });
    expect(() => pipeline.run({ execution, operation: "create_validation" })).toThrow(
      ValidatorRuleException,
    );
    vi.restoreAllMocks();
  });

  it("resolves and attaches declared rules, recording rule usage", () => {
    const { pipeline, registry, metrics } = buildPipeline();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, {
      id: "rule-1",
      ruleId: "rule-1",
      name: "Rule",
      tenantId: "t-1",
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
      severity: "medium",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const execution = buildExecution({ ruleIds: ["rule-1"] });
    const result = pipeline.run({ execution, operation: "create_validation" });
    expect(result.resolvedRules).toHaveLength(1);
    expect(metrics.snapshot().ruleUsageCount).toBe(1);
  });

  it("throws ValidatorPolicyException when a declared policy does not resolve (Stage 3, bypassing Stage 1's own Policy check)", () => {
    const { pipeline } = buildPipeline();
    vi.spyOn(KnowledgeValidatorValidator.prototype, "validate").mockReturnValueOnce({
      valid: true,
      issues: [],
    });
    const execution = buildExecution({
      ruleIds: [],
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      policyId: "missing-policy",
    });
    expect(() => pipeline.run({ execution, operation: "create_validation" })).toThrow(
      ValidatorPolicyException,
    );
    vi.restoreAllMocks();
  });

  it("throws ValidatorPolicyException when the resolved policy denies the request (Stage 3, bypassing Stage 1's own Policy check)", () => {
    const { pipeline, resolver } = buildPipeline();
    resolver.registerPolicy({
      id: "p-1",
      policyId: "p-1",
      name: "Policy",
      tenantId: "t-1",
      allowedCategories: [KnowledgeValidationCategory.SECURITY_VALIDATION],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    vi.spyOn(KnowledgeValidatorValidator.prototype, "validate").mockReturnValueOnce({
      valid: true,
      issues: [],
    });
    const execution = buildExecution({
      ruleIds: [],
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      policyId: "p-1",
    });
    expect(() => pipeline.run({ execution, operation: "create_validation" })).toThrow(
      ValidatorPolicyException,
    );
    vi.restoreAllMocks();
  });

  it("resolves and attaches an allowed policy, recording policy usage", () => {
    const { pipeline, resolver, metrics } = buildPipeline();
    resolver.registerPolicy({
      id: "p-1",
      policyId: "p-1",
      name: "Policy",
      tenantId: "t-1",
      allowedCategories: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const execution = buildExecution({
      ruleIds: [],
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      policyId: "p-1",
    });
    const result = pipeline.run({ execution, operation: "create_validation" });
    expect(result.policy?.policyId).toBe("p-1");
    expect(metrics.snapshot().policyUsageCount).toBe(1);
  });

  it("throws ValidatorConfigurationException when a declared configuration does not resolve", () => {
    const { pipeline } = buildPipeline();
    const execution = buildExecution({
      ruleIds: [],
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      configurationId: "missing-config",
    });
    expect(() => pipeline.run({ execution, operation: "create_validation" })).toThrow(
      ValidatorConfigurationException,
    );
  });

  it("resolves and attaches a declared configuration, recording configuration usage", () => {
    const { pipeline, registry, metrics } = buildPipeline();
    registry.register(KnowledgeValidatorRegistryBucket.CONFIGURATION, {
      id: "c-1",
      configurationId: "c-1",
      validationId: "v-1",
      tenantId: "t-1",
      custom: {},
      createdAt: now,
    });
    const execution = buildExecution({
      ruleIds: [],
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      configurationId: "c-1",
    });
    const result = pipeline.run({ execution, operation: "create_validation" });
    expect(result.configuration?.configurationId).toBe("c-1");
    expect(metrics.snapshot().configurationUsageCount).toBe(1);
  });

  it("is a documented no-op for Decision Resolution when no decision is present", () => {
    const { pipeline, metrics } = buildPipeline();
    pipeline.run({
      execution: buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION }),
      operation: "create_validation",
    });
    expect(metrics.snapshot().decisionCount).toBe(0);
  });

  it("validates a supplied decision and records it via Decision Resolution", () => {
    const { pipeline, metrics } = buildPipeline();
    const execution = buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION });
    pipeline.run({
      execution,
      operation: "approve_validation",
      decision: {
        id: "d-1",
        decisionId: "d-1",
        validationId: "v-1",
        tenantId: "t-1",
        value: KnowledgeValidationDecisionValue.APPROVED,
        reportedBy: "user-1",
        confidence: 0.75,
        recordedAt: now,
      },
    });
    expect(metrics.snapshot().decisionCount).toBe(1);
    expect(metrics.snapshot().averageConfidenceMetadata).toBeCloseTo(0.75);
  });

  it("throws ValidatorDecisionException for an unknown decision value (Stage 5, bypassing Stage 1's own Decision check)", () => {
    const { pipeline } = buildPipeline();
    vi.spyOn(KnowledgeValidatorValidator.prototype, "validate").mockReturnValueOnce({
      valid: true,
      issues: [],
    });
    const execution = buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION });
    expect(() =>
      pipeline.run({
        execution,
        operation: "approve_validation",
        decision: {
          id: "d-1",
          decisionId: "d-1",
          validationId: "v-1",
          tenantId: "t-1",
          value: "unknown" as KnowledgeValidationDecisionValue,
          reportedBy: "user-1",
          recordedAt: now,
        },
      }),
    ).toThrow(ValidatorDecisionException);
    vi.restoreAllMocks();
  });

  it("stamps updated metadata timestamps", () => {
    const { pipeline } = buildPipeline();
    const result = pipeline.run({
      execution: buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION }),
      operation: "create_validation",
    });
    expect(result.metadata.updatedAt).toBeDefined();
  });

  it("records a validation on the metrics collector for every run", () => {
    const { pipeline, metrics } = buildPipeline();
    pipeline.run({
      execution: buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION }),
      operation: "create_validation",
    });
    expect(metrics.snapshot().validationCount).toBe(1);
  });

  it("advances the state machine when a target state differs from the current state", () => {
    const { pipeline } = buildPipeline();
    const execution = buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION });
    const result = pipeline.run({
      execution,
      operation: "queue_validation",
      targetState: KnowledgeValidationState.QUEUED,
    });
    expect(result.instance.state).toBe(KnowledgeValidationState.QUEUED);
  });

  it("does not advance the state machine when targetState equals the current state", () => {
    const { pipeline } = buildPipeline();
    const execution = buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION });
    const result = pipeline.run({
      execution,
      operation: "noop",
      targetState: KnowledgeValidationState.DRAFT,
    });
    expect(result.history).toHaveLength(0);
  });

  it("appends one Audit entry per run, registered in the AUDIT bucket", () => {
    const { pipeline, registry } = buildPipeline();
    const result = pipeline.run({
      execution: buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION }),
      operation: "create_validation",
    });
    expect(result.auditTrail).toHaveLength(1);
    expect(registry.count(KnowledgeValidatorRegistryBucket.AUDIT)).toBe(1);
  });

  it("appends one structured log entry per run", () => {
    const { pipeline } = buildPipeline();
    const result = pipeline.run({
      execution: buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION }),
      operation: "create_validation",
    });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.level).toBe("info");
  });

  it("carries a forward decision already recorded on the execution into Decision Resolution", () => {
    const { pipeline, metrics } = buildPipeline();
    const execution = {
      ...buildExecution({ category: KnowledgeValidationCategory.CUSTOM_VALIDATION }),
      decision: {
        id: "d-1",
        decisionId: "d-1",
        validationId: "v-1",
        tenantId: "t-1",
        value: KnowledgeValidationDecisionValue.REJECTED,
        reportedBy: "user-1",
        recordedAt: now,
      },
    };
    pipeline.run({ execution, operation: "archive_validation" });
    expect(metrics.snapshot().decisionCount).toBe(1);
  });
});
