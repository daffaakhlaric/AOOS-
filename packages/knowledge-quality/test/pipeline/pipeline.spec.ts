import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import type { KnowledgeQualityExecution } from "../../src/domain/knowledge-quality-execution.js";
import { AssessmentValidationException } from "../../src/errors/assessment-validation-exception.js";
import { QualityConfigurationException } from "../../src/errors/quality-configuration-exception.js";
import { QualityPolicyException } from "../../src/errors/quality-policy-exception.js";
import { QualityProfileException } from "../../src/errors/quality-profile-exception.js";
import { QualityRuleException } from "../../src/errors/quality-rule-exception.js";
import { KnowledgeQualityMetrics } from "../../src/metrics/knowledge-quality-metrics.js";
import { KnowledgeQualityPipeline } from "../../src/pipeline/knowledge-quality-pipeline.js";
import { KnowledgeQualityRegistryBucket } from "../../src/registry/knowledge-quality-registry-bucket.js";
import { KnowledgeQualityRegistry } from "../../src/registry/knowledge-quality-registry.js";
import { KnowledgeQualityResolver } from "../../src/resolver/knowledge-quality-resolver.js";
import { KnowledgeQualityValidator } from "../../src/validator/knowledge-quality-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(
  overrides: Partial<KnowledgeQualityExecution["request"]> = {},
): KnowledgeQualityExecution {
  return {
    instance: {
      id: "g-1",
      token: "kqua_pipe",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeQualityAssessmentState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ assessmentId: "g-1" }),
    metadata: {
      assessmentId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      assessmentId: "g-1",
      mode: KnowledgeQualityAssessmentMode.CUSTOM,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
      ...overrides,
    },
    resolvedRules: [],
    findings: [],
    scoreMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

/** Always-valid stub used to isolate Pipeline stages 2-5's OWN resolution/exception logic
 * from the 12-stage Validator's overlapping pre-flight checks (the Validator normally
 * catches an unresolvable reference before the Pipeline stage that would otherwise
 * throw for it ever runs — this stub lets these tests exercise that stage in isolation). */
const permissiveValidator = {
  stageNames: [] as readonly string[],
  validate: () => ({ valid: true, issues: [] }),
} as unknown as KnowledgeQualityValidator;

describe("KnowledgeQualityPipeline", () => {
  let registry: KnowledgeQualityRegistry;
  let resolver: KnowledgeQualityResolver;
  let metrics: KnowledgeQualityMetrics;
  let pipeline: KnowledgeQualityPipeline;
  let permissivePipeline: KnowledgeQualityPipeline;

  beforeEach(() => {
    registry = new KnowledgeQualityRegistry();
    resolver = new KnowledgeQualityResolver(registry);
    metrics = new KnowledgeQualityMetrics();
    pipeline = new KnowledgeQualityPipeline(
      new KnowledgeQualityValidator(),
      metrics,
      registry,
      resolver,
    );
    permissivePipeline = new KnowledgeQualityPipeline(
      permissiveValidator,
      metrics,
      registry,
      resolver,
    );
  });

  function registerRule(ruleId: string): void {
    registry.register(KnowledgeQualityRegistryBucket.RULE, {
      id: ruleId,
      ruleId,
      name: "Rule",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.ACCURACY,
      severity: "medium",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  it("runs all 10 stages for a minimal valid Request (Custom mode, no references)", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_assessment" });
    expect(result.auditTrail).toHaveLength(1);
    expect(result.logs).toHaveLength(1);
    expect(metrics.snapshot().assessmentCount).toBe(1);
  });

  it("Stage 1 — throws AssessmentValidationException on invalid input", () => {
    const execution = buildExecution({ requestedBy: "" });
    expect(() => pipeline.run({ execution, operation: "create_assessment" })).toThrow(
      AssessmentValidationException,
    );
  });

  it("Stage 1 — records validation metrics on success and failure", () => {
    pipeline.run({ execution: buildExecution(), operation: "create_assessment" });
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(0);
    try {
      pipeline.run({
        execution: buildExecution({ requestedBy: "" }),
        operation: "create_assessment",
      });
    } catch {
      /* expected */
    }
    expect(metrics.snapshot().validationFailureCount).toBe(1);
  });

  it("Stage 2 — resolves and attaches declared Rules", () => {
    registerRule("rule-1");
    const execution = buildExecution({
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      ruleIds: ["rule-1"],
    });
    const result = pipeline.run({ execution, operation: "create_assessment" });
    expect(result.resolvedRules.map((rule) => rule.ruleId)).toEqual(["rule-1"]);
    expect(metrics.snapshot().ruleUsageCount).toBe(1);
  });

  it("Stage 2 — throws QualityRuleException for an unregistered Rule id", () => {
    const execution = buildExecution({
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      ruleIds: ["missing"],
    });
    expect(() => permissivePipeline.run({ execution, operation: "create_assessment" })).toThrow(
      QualityRuleException,
    );
  });

  it("Stage 3 — resolves and attaches a declared Profile", () => {
    registry.register(KnowledgeQualityRegistryBucket.PROFILE, {
      id: "profile-1",
      profileId: "profile-1",
      name: "Profile",
      tenantId: "tenant-1",
      ruleIds: [],
      dimensionWeights: {},
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const execution = buildExecution({
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      profileId: "profile-1",
    });
    const result = pipeline.run({ execution, operation: "create_assessment" });
    expect(result.profile?.profileId).toBe("profile-1");
    expect(metrics.snapshot().profileUsageCount).toBe(1);
  });

  it("Stage 3 — throws QualityProfileException for an unregistered Profile id", () => {
    const execution = buildExecution({
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      profileId: "missing",
    });
    expect(() => permissivePipeline.run({ execution, operation: "create_assessment" })).toThrow(
      QualityProfileException,
    );
  });

  it("Stage 4 — resolves and evaluates an allowing Policy", () => {
    registerRule("rule-1");
    resolver.registerPolicy({
      id: "policy-1",
      policyId: "policy-1",
      name: "Policy",
      tenantId: "tenant-1",
      allowedDimensions: [],
      allowedModes: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const execution = buildExecution({
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      ruleIds: ["rule-1"],
      policyId: "policy-1",
    });
    const result = pipeline.run({ execution, operation: "create_assessment" });
    expect(result.policy?.policyId).toBe("policy-1");
    expect(metrics.snapshot().policyUsageCount).toBe(1);
  });

  it("Stage 4 — throws QualityPolicyException for an unregistered Policy id", () => {
    const execution = buildExecution({
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      ruleIds: [],
      policyId: "missing",
    });
    expect(() => permissivePipeline.run({ execution, operation: "create_assessment" })).toThrow(
      QualityPolicyException,
    );
  });

  it("Stage 4 — throws QualityPolicyException for a denying Policy", () => {
    registerRule("rule-1");
    resolver.registerPolicy({
      id: "policy-1",
      policyId: "policy-1",
      name: "Policy",
      tenantId: "tenant-1",
      allowedDimensions: [KnowledgeQualityDimension.CLARITY],
      allowedModes: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const execution = buildExecution({
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      ruleIds: ["rule-1"],
      policyId: "policy-1",
    });
    expect(() => permissivePipeline.run({ execution, operation: "create_assessment" })).toThrow(
      QualityPolicyException,
    );
  });

  it("Stage 5 — resolves and attaches a declared Configuration", () => {
    registry.register(KnowledgeQualityRegistryBucket.CONFIGURATION, {
      id: "cfg-1",
      configurationId: "cfg-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      custom: {},
      createdAt: now,
    });
    const execution = buildExecution({ configurationId: "cfg-1" });
    const result = pipeline.run({ execution, operation: "create_assessment" });
    expect(result.configuration?.configurationId).toBe("cfg-1");
    expect(metrics.snapshot().configurationUsageCount).toBe(1);
  });

  it("Stage 5 — throws QualityConfigurationException for an unregistered Configuration id", () => {
    const execution = buildExecution({ configurationId: "missing" });
    expect(() => permissivePipeline.run({ execution, operation: "create_assessment" })).toThrow(
      QualityConfigurationException,
    );
  });

  it("Stage 6 — stamps metadata.updatedAt", () => {
    const before = buildExecution();
    const result = pipeline.run({ execution: before, operation: "create_assessment" });
    expect(Date.parse(result.metadata.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(before.metadata.updatedAt),
    );
  });

  it("Stage 7 — records assessment count", () => {
    pipeline.run({ execution: buildExecution(), operation: "create_assessment" });
    pipeline.run({
      execution: {
        ...buildExecution(),
        instance: { ...buildExecution().instance, token: "kqua_2" },
      },
      operation: "create_assessment",
    });
    expect(metrics.snapshot().assessmentCount).toBe(2);
  });

  it("Stage 8 — advances the State Machine when targetState differs", () => {
    const result = pipeline.run({
      execution: buildExecution(),
      operation: "queue_assessment",
      targetState: KnowledgeQualityAssessmentState.QUEUED,
    });
    expect(result.instance.state).toBe(KnowledgeQualityAssessmentState.QUEUED);
    expect(result.history).toHaveLength(1);
  });

  it("Stage 8 — is a no-op when targetState equals the current state", () => {
    const result = pipeline.run({
      execution: buildExecution(),
      operation: "create_assessment",
      targetState: KnowledgeQualityAssessmentState.DRAFT,
    });
    expect(result.history).toHaveLength(0);
  });

  it("Stage 9 — appends one Audit entry and registers it in the AUDIT bucket", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_assessment" });
    expect(result.auditTrail).toHaveLength(1);
    expect(registry.count(KnowledgeQualityRegistryBucket.AUDIT)).toBe(1);
  });

  it("Stage 9 — audit entry records the actor from requestedBy", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_assessment" });
    expect(result.auditTrail[0]?.actor).toBe("user-1");
  });

  it("Stage 10 — appends one structured log entry", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_assessment" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.level).toBe("info");
  });

  it("running the pipeline twice accumulates history/audit/logs", () => {
    let result = pipeline.run({ execution: buildExecution(), operation: "create_assessment" });
    result = pipeline.run({
      execution: result,
      operation: "queue_assessment",
      targetState: KnowledgeQualityAssessmentState.QUEUED,
    });
    expect(result.auditTrail).toHaveLength(2);
    expect(result.logs).toHaveLength(2);
    expect(result.history).toHaveLength(1);
  });
});
