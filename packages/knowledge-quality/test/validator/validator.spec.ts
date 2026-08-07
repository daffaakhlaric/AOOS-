import { describe, expect, it } from "vitest";

import type { KnowledgeQualityValidationInput } from "../../src/contracts/i-knowledge-quality-validator.js";
import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { AssessmentValidator } from "../../src/validator/assessment-validator.js";
import { AuditValidator } from "../../src/validator/audit-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { IdentityValidator } from "../../src/validator/identity-validator.js";
import { IntegrityValidator } from "../../src/validator/integrity-validator.js";
import { KnowledgeQualityValidator } from "../../src/validator/knowledge-quality-validator.js";
import { LifecycleValidator } from "../../src/validator/lifecycle-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { PolicyValidator } from "../../src/validator/policy-validator.js";
import { ProfileValidator } from "../../src/validator/profile-validator.js";
import { RuleValidator } from "../../src/validator/rule-validator.js";
import { StatisticsValidator } from "../../src/validator/statistics-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function validInput(): KnowledgeQualityValidationInput {
  const context = contextFixture({ assessmentId: "g-1", tenantId: "tenant-1" });
  return {
    assessment: {
      id: "g-1",
      token: context.token,
      assessmentId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeQualityAssessmentState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
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
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      targetReference: "target-1",
      ruleIds: ["rule-1"],
      requestedBy: "user-1",
      createdAt: now,
    },
    context,
    currentState: KnowledgeQualityAssessmentState.DRAFT,
    rulesResolvable: true,
    resolvedRules: [
      {
        id: "rule-1",
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.ACCURACY,
        severity: "medium",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

describe("KnowledgeQualityValidator (aggregate)", () => {
  it("has exactly 12 built-in stages", () => {
    const validator = new KnowledgeQualityValidator();
    expect(validator.stageNames).toEqual([
      "identity",
      "metadata",
      "assessment",
      "rule",
      "profile",
      "policy",
      "configuration",
      "lifecycle",
      "dependency",
      "statistics",
      "integrity",
      "audit",
    ]);
  });

  it("passes a fully valid input", () => {
    const validator = new KnowledgeQualityValidator();
    const result = validator.validate(validInput());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple failing stages without short-circuiting", () => {
    const validator = new KnowledgeQualityValidator();
    const input: KnowledgeQualityValidationInput = {
      ...validInput(),
      metadata: { ...validInput().metadata, title: "" },
      request: { ...validInput().request, requestedBy: "" },
    };
    const result = validator.validate(input);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("supports extraStages", () => {
    const validator = new KnowledgeQualityValidator({
      extraStages: [
        {
          name: "custom",
          validate: () => ({ valid: false, issues: [{ path: "custom", message: "nope" }] }),
        },
      ],
    });
    const result = validator.validate(validInput());
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ path: "custom", message: "nope" });
    expect(validator.stageNames).toContain("custom");
  });
});

describe("Stage 1 — IdentityValidator", () => {
  const stage = new IdentityValidator();

  it("passes a consistent identity", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank assessmentId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      assessment: { ...input.assessment, assessmentId: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags mismatched metadata.assessmentId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      metadata: { ...input.metadata, assessmentId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags mismatched request.assessmentId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, assessmentId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed context token", () => {
    const input = validInput();
    const result = stage.validate({ ...input, context: { ...input.context, token: "bad" } });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 2 — MetadataValidator", () => {
  const stage = new MetadataValidator();

  it("passes valid metadata", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank title", () => {
    const input = validInput();
    expect(stage.validate({ ...input, metadata: { ...input.metadata, title: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a blank tenantId", () => {
    const input = validInput();
    expect(stage.validate({ ...input, metadata: { ...input.metadata, tenantId: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a malformed createdAt", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, metadata: { ...input.metadata, createdAt: "not-a-date" } }).valid,
    ).toBe(false);
  });

  it("flags a malformed updatedAt", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, metadata: { ...input.metadata, updatedAt: "not-a-date" } }).valid,
    ).toBe(false);
  });
});

describe("Stage 3 — AssessmentValidator", () => {
  const stage = new AssessmentValidator();

  it("passes a valid Request", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank requestId", () => {
    const input = validInput();
    expect(stage.validate({ ...input, request: { ...input.request, requestId: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a blank requestedBy", () => {
    const input = validInput();
    expect(stage.validate({ ...input, request: { ...input.request, requestedBy: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a blank targetReference", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, request: { ...input.request, targetReference: "" } }).valid,
    ).toBe(false);
  });

  it("flags an unknown mode", () => {
    const input = validInput();
    expect(
      stage.validate({
        ...input,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request: { ...input.request, mode: "unknown" as any },
      }).valid,
    ).toBe(false);
  });
});

describe("Stage 4 — RuleValidator", () => {
  const stage = new RuleValidator();

  it("passes when declared Rules are all resolvable", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("passes when no Rules are declared", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, ruleIds: [] },
      rulesResolvable: undefined,
      resolvedRules: [],
    });
    expect(result.valid).toBe(true);
  });

  it("flags a declared but unresolvable Rule id", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, ruleIds: ["missing"] },
      rulesResolvable: false,
      resolvedRules: [],
    });
    expect(result.valid).toBe(false);
  });

  it("flags only the unresolved ids when some Rule ids resolve and others do not", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, ruleIds: ["rule-1", "missing"] },
      rulesResolvable: false,
      resolvedRules: input.resolvedRules,
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toContain("missing");
  });
});

describe("Stage 5 — ProfileValidator", () => {
  const stage = new ProfileValidator();

  it("passes when no Profile is declared", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("passes when the declared Profile resolves", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, profileId: "profile-1" },
      profileResolvable: true,
    });
    expect(result.valid).toBe(true);
  });

  it("flags a declared but unresolvable Profile", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, profileId: "profile-1" },
      profileResolvable: false,
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 6 — PolicyValidator", () => {
  const stage = new PolicyValidator();

  it("passes when no Policy is declared", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a declared but unresolvable Policy", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a resolved Policy that denies the Request", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
      policy: {
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
      },
    });
    expect(result.valid).toBe(false);
  });

  it("passes a resolved Policy that allows the Request", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
      policy: {
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
      },
    });
    expect(result.valid).toBe(true);
  });

  it("defaults to an empty Dimension list when resolvedRules is undefined", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
      resolvedRules: undefined,
      policy: {
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
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe("Stage 7 — ConfigurationValidator", () => {
  const stage = new ConfigurationValidator();
  const baseConfig = {
    id: "cfg-1",
    configurationId: "cfg-1",
    assessmentId: "g-1",
    tenantId: "tenant-1",
    custom: {},
    createdAt: now,
  };

  it("passes when no Configuration is present", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("passes a valid Configuration", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, timeoutMs: 5000, retries: 3, maxFindings: 10 },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a non-positive timeoutMs", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, timeoutMs: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags an out-of-range retries", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, retries: 11 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a non-positive maxFindings", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, maxFindings: -1 },
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 8 — LifecycleValidator", () => {
  const stage = new LifecycleValidator();

  it("passes when no states are supplied", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, currentState: undefined, targetState: undefined }).valid,
    ).toBe(true);
  });

  it("passes a legal transition", () => {
    const result = stage.validate({
      ...validInput(),
      currentState: KnowledgeQualityAssessmentState.DRAFT,
      targetState: KnowledgeQualityAssessmentState.QUEUED,
    });
    expect(result.valid).toBe(true);
  });

  it("passes a no-op transition (current === target)", () => {
    const result = stage.validate({
      ...validInput(),
      currentState: KnowledgeQualityAssessmentState.DRAFT,
      targetState: KnowledgeQualityAssessmentState.DRAFT,
    });
    expect(result.valid).toBe(true);
  });

  it("flags an illegal transition", () => {
    const result = stage.validate({
      ...validInput(),
      currentState: KnowledgeQualityAssessmentState.DRAFT,
      targetState: KnowledgeQualityAssessmentState.COMPLETED,
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 9 — DependencyValidator", () => {
  const stage = new DependencyValidator();

  it("passes when a non-Custom Mode declares at least one Rule", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a non-Custom Mode with no Rules and no Profile", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, ruleIds: [], profileId: undefined },
    });
    expect(result.valid).toBe(false);
  });

  it("passes a non-Custom Mode with a Profile and no Rules", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, ruleIds: [], profileId: "profile-1" },
    });
    expect(result.valid).toBe(true);
  });

  it("passes a Custom Mode with no Rules and no Profile", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: {
        ...input.request,
        mode: KnowledgeQualityAssessmentMode.CUSTOM,
        ruleIds: [],
        profileId: undefined,
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a Policy requiring approval with no Configuration", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
      policy: {
        id: "policy-1",
        policyId: "policy-1",
        name: "Policy",
        tenantId: "tenant-1",
        allowedDimensions: [],
        allowedModes: [],
        requireApproval: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.valid).toBe(false);
  });

  it("passes a Policy requiring approval when a Configuration is present", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
      policy: {
        id: "policy-1",
        policyId: "policy-1",
        name: "Policy",
        tenantId: "tenant-1",
        allowedDimensions: [],
        allowedModes: [],
        requireApproval: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      configuration: {
        id: "cfg-1",
        configurationId: "cfg-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        custom: {},
        createdAt: now,
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe("Stage 10 — StatisticsValidator", () => {
  const stage = new StatisticsValidator();

  it("passes when no statisticsSnapshot is present", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("passes a well-formed snapshot", () => {
    const result = stage.validate({
      ...validInput(),
      statisticsSnapshot: { requestedCount: 3, completedCount: 1, failedCount: 1 },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a negative requestedCount", () => {
    const result = stage.validate({
      ...validInput(),
      statisticsSnapshot: { requestedCount: -1, completedCount: 0, failedCount: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a negative completedCount", () => {
    const result = stage.validate({
      ...validInput(),
      statisticsSnapshot: { requestedCount: 1, completedCount: -1, failedCount: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a negative failedCount", () => {
    const result = stage.validate({
      ...validInput(),
      statisticsSnapshot: { requestedCount: 1, completedCount: 0, failedCount: -1 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags completedCount + failedCount exceeding requestedCount", () => {
    const result = stage.validate({
      ...validInput(),
      statisticsSnapshot: { requestedCount: 1, completedCount: 1, failedCount: 1 },
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 11 — IntegrityValidator", () => {
  const stage = new IntegrityValidator();

  it("passes matching tenantId across Metadata/Context", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags mismatched tenantId between Context and Metadata", () => {
    const input = validInput();
    const result = stage.validate({ ...input, context: { ...input.context, tenantId: "other" } });
    expect(result.valid).toBe(false);
  });

  it("flags mismatched Profile tenantId vs Metadata tenantId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      profile: {
        id: "profile-1",
        profileId: "profile-1",
        name: "Profile",
        tenantId: "other-tenant",
        ruleIds: [],
        dimensionWeights: {},
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.valid).toBe(false);
  });

  it("passes a matching Profile tenantId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      profile: {
        id: "profile-1",
        profileId: "profile-1",
        name: "Profile",
        tenantId: "tenant-1",
        ruleIds: [],
        dimensionWeights: {},
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe("Stage 12 — AuditValidator", () => {
  const stage = new AuditValidator();

  it("passes a well-formed audit actor/timestamp", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank requestedBy", () => {
    const input = validInput();
    expect(stage.validate({ ...input, request: { ...input.request, requestedBy: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a malformed request.createdAt", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, request: { ...input.request, createdAt: "not-a-date" } }).valid,
    ).toBe(false);
  });
});
