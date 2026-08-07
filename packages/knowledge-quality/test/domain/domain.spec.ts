import { describe, expect, it } from "vitest";

import { knowledgeAssessmentAuditSchema } from "../../src/domain/knowledge-quality-assessment-audit.js";
import { knowledgeAssessmentJobSchema } from "../../src/domain/knowledge-quality-assessment-job.js";
import { knowledgeAssessmentMetadataSchema } from "../../src/domain/knowledge-quality-assessment-metadata.js";
import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { knowledgeQualityAssessmentRequestSchema } from "../../src/domain/knowledge-quality-assessment-request.js";
import { knowledgeAssessmentSessionSchema } from "../../src/domain/knowledge-quality-assessment-session.js";
import {
  KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES,
  KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS,
  KNOWLEDGE_QUALITY_ASSESSMENT_TERMINAL_STATES,
  KnowledgeQualityAssessmentState,
} from "../../src/domain/knowledge-quality-assessment-state.js";
import { EMPTY_KNOWLEDGE_QUALITY_ASSESSMENT_STATISTICS } from "../../src/domain/knowledge-quality-assessment-statistics-snapshot.js";
import { knowledgeQualityAssessmentSchema } from "../../src/domain/knowledge-quality-assessment.js";
import { knowledgeQualityConfigurationSchema } from "../../src/domain/knowledge-quality-configuration.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { knowledgeQualityFindingSchema } from "../../src/domain/knowledge-quality-finding.js";
import {
  evaluateKnowledgeQualityPolicy,
  knowledgeQualityPolicySchema,
} from "../../src/domain/knowledge-quality-policy.js";
import { knowledgeQualityProfileSchema } from "../../src/domain/knowledge-quality-profile.js";
import { knowledgeQualityReportSchema } from "../../src/domain/knowledge-quality-report.js";
import { knowledgeQualityRuleSchema } from "../../src/domain/knowledge-quality-rule.js";
import { knowledgeQualityScoreMetadataSchema } from "../../src/domain/knowledge-quality-score-metadata.js";
import { KnowledgeQualitySessionState } from "../../src/domain/knowledge-quality-session-state.js";

const now = new Date().toISOString();

describe("Quality Dimensions (KnowledgeQualityDimension)", () => {
  it("has exactly 12 Quality Dimensions", () => {
    expect(Object.values(KnowledgeQualityDimension)).toHaveLength(12);
  });
});

describe("Assessment Modes (KnowledgeQualityAssessmentMode)", () => {
  it("has exactly 8 Assessment Modes", () => {
    expect(Object.values(KnowledgeQualityAssessmentMode)).toHaveLength(8);
  });
});

describe("Lifecycle (KnowledgeQualityAssessmentState)", () => {
  it("has exactly 10 states", () => {
    expect(Object.values(KnowledgeQualityAssessmentState)).toHaveLength(10);
  });

  it("Destroyed is the only terminal state", () => {
    expect(KNOWLEDGE_QUALITY_ASSESSMENT_TERMINAL_STATES.size).toBe(1);
    expect(
      KNOWLEDGE_QUALITY_ASSESSMENT_TERMINAL_STATES.has(KnowledgeQualityAssessmentState.DESTROYED),
    ).toBe(true);
  });

  it("Destroyed has no outgoing edges", () => {
    expect(
      KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS[KnowledgeQualityAssessmentState.DESTROYED],
    ).toEqual([]);
  });

  it("every state is reachable from Draft", () => {
    const reachable = new Set<KnowledgeQualityAssessmentState>([
      KnowledgeQualityAssessmentState.DRAFT,
    ]);
    let frontier = [KnowledgeQualityAssessmentState.DRAFT];
    while (frontier.length > 0) {
      const next: KnowledgeQualityAssessmentState[] = [];
      for (const state of frontier) {
        for (const target of KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS[state]) {
          if (!reachable.has(target)) {
            reachable.add(target);
            next.push(target);
          }
        }
      }
      frontier = next;
    }
    expect(reachable.size).toBe(Object.values(KnowledgeQualityAssessmentState).length);
  });

  it("every non-terminal state has at least one outgoing edge", () => {
    for (const state of Object.values(KnowledgeQualityAssessmentState)) {
      if (state === KnowledgeQualityAssessmentState.DESTROYED) {
        continue;
      }
      expect(KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS[state].length).toBeGreaterThan(0);
    }
  });

  it("settled states include Completed/Cancelled/Failed/Archived/Destroyed", () => {
    expect(
      KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES.has(KnowledgeQualityAssessmentState.COMPLETED),
    ).toBe(true);
    expect(
      KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES.has(KnowledgeQualityAssessmentState.CANCELLED),
    ).toBe(true);
    expect(
      KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES.has(KnowledgeQualityAssessmentState.FAILED),
    ).toBe(true);
    expect(
      KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES.has(KnowledgeQualityAssessmentState.ARCHIVED),
    ).toBe(true);
    expect(
      KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES.has(KnowledgeQualityAssessmentState.DRAFT),
    ).toBe(false);
  });
});

describe("KnowledgeQualitySessionState", () => {
  it("has exactly 4 states", () => {
    expect(Object.values(KnowledgeQualitySessionState)).toHaveLength(4);
  });
});

describe("KnowledgeQualityAssessment schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeQualityAssessmentSchema.parse({
      id: "g-1",
      token: "kqua_x",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeQualityAssessmentState.DRAFT,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.assessmentId).toBe("g-1");
  });

  it("rejects a missing assessmentId", () => {
    expect(() =>
      knowledgeQualityAssessmentSchema.parse({
        id: "g-1",
        token: "kqua_x",
        tenantId: "tenant-1",
        state: KnowledgeQualityAssessmentState.DRAFT,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });
});

describe("KnowledgeQualityAssessmentJob schema", () => {
  it("parses a valid record with default priority", () => {
    const parsed = knowledgeAssessmentJobSchema.parse({
      id: "j-1",
      jobId: "j-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      createdAt: now,
    });
    expect(parsed.priority).toBe(5);
  });
});

describe("KnowledgeQualityAssessmentSession schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeAssessmentSessionSchema.parse({
      id: "s-1",
      sessionId: "s-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      holder: "user-1",
      state: KnowledgeQualitySessionState.OPEN,
      openedAt: now,
    });
    expect(parsed.state).toBe(KnowledgeQualitySessionState.OPEN);
  });
});

describe("KnowledgeQualityAssessmentRequest schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeQualityAssessmentRequestSchema.parse({
      id: "r-1",
      requestId: "r-1",
      assessmentId: "g-1",
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      targetReference: "doc-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    });
    expect(parsed.mode).toBe(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
  });
});

describe("KnowledgeQualityRule schema", () => {
  it("parses a valid record with default severity/active", () => {
    const parsed = knowledgeQualityRuleSchema.parse({
      id: "rule-1",
      ruleId: "rule-1",
      name: "Rule",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.ACCURACY,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.severity).toBe("medium");
    expect(parsed.active).toBe(true);
  });
});

describe("KnowledgeQualityProfile schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeQualityProfileSchema.parse({
      id: "profile-1",
      profileId: "profile-1",
      name: "Profile",
      tenantId: "tenant-1",
      ruleIds: ["rule-1"],
      dimensionWeights: { [KnowledgeQualityDimension.ACCURACY]: 1 },
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.ruleIds).toEqual(["rule-1"]);
  });
});

describe("KnowledgeQualityFinding schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeQualityFindingSchema.parse({
      id: "finding-1",
      findingId: "finding-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.CLARITY,
      severity: "high",
      description: "Something is unclear",
      createdAt: now,
    });
    expect(parsed.severity).toBe("high");
  });
});

describe("KnowledgeQualityReport schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeQualityReportSchema.parse({
      id: "report-1",
      reportId: "report-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      findingIds: [],
      scoreMetadataIds: [],
      generatedAt: now,
    });
    expect(parsed.reportId).toBe("report-1");
  });
});

describe("KnowledgeQualityScoreMetadata schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeQualityScoreMetadataSchema.parse({
      id: "score-1",
      scoreId: "score-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.COMPLETENESS,
      value: 0.9,
      providerId: "provider-1",
      recordedAt: now,
    });
    expect(parsed.value).toBe(0.9);
  });
});

describe("KnowledgeQualityAssessmentMetadata schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeAssessmentMetadataSchema.parse({
      assessmentId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.title).toBe("Title");
  });
});

describe("KnowledgeQualityConfiguration schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeQualityConfigurationSchema.parse({
      id: "cfg-1",
      configurationId: "cfg-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      custom: {},
      createdAt: now,
    });
    expect(parsed.configurationId).toBe("cfg-1");
  });
});

describe("KnowledgeQualityPolicy schema + evaluateKnowledgeQualityPolicy", () => {
  const basePolicy = knowledgeQualityPolicySchema.parse({
    id: "pol-1",
    policyId: "pol-1",
    name: "Policy",
    tenantId: "tenant-1",
    allowedDimensions: [],
    allowedModes: [],
    createdAt: now,
    updatedAt: now,
  });

  it("defaults active=true and requireApproval=false", () => {
    expect(basePolicy.active).toBe(true);
    expect(basePolicy.requireApproval).toBe(false);
  });

  it("allows everything when allow-lists are empty and Policy is active", () => {
    const result = evaluateKnowledgeQualityPolicy(basePolicy, {
      dimensions: [KnowledgeQualityDimension.ACCURACY],
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
    });
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("denies everything when the Policy is inactive", () => {
    const result = evaluateKnowledgeQualityPolicy(
      { ...basePolicy, active: false },
      {
        dimensions: [KnowledgeQualityDimension.ACCURACY],
        mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("denies a Dimension outside the allow-list", () => {
    const result = evaluateKnowledgeQualityPolicy(
      { ...basePolicy, allowedDimensions: [KnowledgeQualityDimension.CLARITY] },
      {
        dimensions: [KnowledgeQualityDimension.ACCURACY],
        mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies an Assessment Mode outside the allow-list", () => {
    const result = evaluateKnowledgeQualityPolicy(
      { ...basePolicy, allowedModes: [KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT] },
      {
        dimensions: [KnowledgeQualityDimension.ACCURACY],
        mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("allows a request matching a non-empty allow-list", () => {
    const result = evaluateKnowledgeQualityPolicy(
      {
        ...basePolicy,
        allowedDimensions: [KnowledgeQualityDimension.ACCURACY],
        allowedModes: [KnowledgeQualityAssessmentMode.FULL_ASSESSMENT],
      },
      {
        dimensions: [KnowledgeQualityDimension.ACCURACY],
        mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      },
    );
    expect(result.allowed).toBe(true);
  });
});

describe("KnowledgeQualityAssessmentAudit schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeAssessmentAuditSchema.parse({
      id: "a-1",
      auditId: "a-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      operation: "create_assessment",
      occurredAt: now,
    });
    expect(parsed.operation).toBe("create_assessment");
  });
});

describe("KnowledgeQualityAssessmentStatisticsSnapshot", () => {
  it("EMPTY snapshot has zeroed counters", () => {
    expect(EMPTY_KNOWLEDGE_QUALITY_ASSESSMENT_STATISTICS).toEqual({
      requestedCount: 0,
      completedCount: 0,
      failedCount: 0,
    });
  });
});
