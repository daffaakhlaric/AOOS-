import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { knowledgeQualityConfigurationSchema } from "../../src/domain/knowledge-quality-configuration.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import {
  KNOWLEDGE_QUALITY_FINDING_SEVERITIES,
  knowledgeQualityFindingSchema,
} from "../../src/domain/knowledge-quality-finding.js";
import { knowledgeQualityPolicySchema } from "../../src/domain/knowledge-quality-policy.js";
import { knowledgeQualityProfileSchema } from "../../src/domain/knowledge-quality-profile.js";
import { knowledgeQualityRuleSchema } from "../../src/domain/knowledge-quality-rule.js";

const now = new Date().toISOString();

describe("KNOWLEDGE_QUALITY_FINDING_SEVERITIES", () => {
  it("has exactly the 5 severities: info, low, medium, high, critical", () => {
    expect(KNOWLEDGE_QUALITY_FINDING_SEVERITIES).toEqual([
      "info",
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });

  it.each(KNOWLEDGE_QUALITY_FINDING_SEVERITIES)(
    "%s is accepted by knowledgeQualityFindingSchema",
    (severity) => {
      const parsed = knowledgeQualityFindingSchema.parse({
        id: "f-1",
        findingId: "f-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.ACCURACY,
        severity,
        description: "text",
        createdAt: now,
      });
      expect(parsed.severity).toBe(severity);
    },
  );
});

describe("knowledgeQualityFindingSchema — rejections", () => {
  it("rejects a blank description", () => {
    expect(() =>
      knowledgeQualityFindingSchema.parse({
        id: "f-1",
        findingId: "f-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.ACCURACY,
        severity: "medium",
        description: "",
        createdAt: now,
      }),
    ).toThrow();
  });

  it("rejects an unknown severity", () => {
    expect(() =>
      knowledgeQualityFindingSchema.parse({
        id: "f-1",
        findingId: "f-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.ACCURACY,
        severity: "catastrophic",
        description: "text",
        createdAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeQualityRuleSchema — rejections", () => {
  it("rejects an unknown dimension", () => {
    expect(() =>
      knowledgeQualityRuleSchema.parse({
        id: "r-1",
        ruleId: "r-1",
        name: "Rule",
        tenantId: "tenant-1",
        dimension: "not-a-dimension",
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it("rejects a blank name", () => {
    expect(() =>
      knowledgeQualityRuleSchema.parse({
        id: "r-1",
        ruleId: "r-1",
        name: "",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.ACCURACY,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeQualityProfileSchema — rejections", () => {
  it("rejects a dimensionWeights value above 1", () => {
    expect(() =>
      knowledgeQualityProfileSchema.parse({
        id: "p-1",
        profileId: "p-1",
        name: "Profile",
        tenantId: "tenant-1",
        ruleIds: [],
        dimensionWeights: { [KnowledgeQualityDimension.ACCURACY]: 1.5 },
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it("rejects a negative dimensionWeights value", () => {
    expect(() =>
      knowledgeQualityProfileSchema.parse({
        id: "p-1",
        profileId: "p-1",
        name: "Profile",
        tenantId: "tenant-1",
        ruleIds: [],
        dimensionWeights: { [KnowledgeQualityDimension.ACCURACY]: -0.1 },
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeQualityPolicySchema — rejections", () => {
  it("rejects an unknown Assessment Mode in allowedModes", () => {
    expect(() =>
      knowledgeQualityPolicySchema.parse({
        id: "pol-1",
        policyId: "pol-1",
        name: "Policy",
        tenantId: "tenant-1",
        allowedDimensions: [],
        allowedModes: ["not-a-mode"],
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it("accepts every declared Assessment Mode", () => {
    const parsed = knowledgeQualityPolicySchema.parse({
      id: "pol-1",
      policyId: "pol-1",
      name: "Policy",
      tenantId: "tenant-1",
      allowedDimensions: [],
      allowedModes: Object.values(KnowledgeQualityAssessmentMode),
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.allowedModes).toHaveLength(8);
  });
});

describe("knowledgeQualityConfigurationSchema — rejections", () => {
  it("rejects a non-positive timeoutMs", () => {
    expect(() =>
      knowledgeQualityConfigurationSchema.parse({
        id: "cfg-1",
        configurationId: "cfg-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        timeoutMs: 0,
        custom: {},
        createdAt: now,
      }),
    ).toThrow();
  });

  it("rejects retries above 10", () => {
    expect(() =>
      knowledgeQualityConfigurationSchema.parse({
        id: "cfg-1",
        configurationId: "cfg-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        retries: 11,
        custom: {},
        createdAt: now,
      }),
    ).toThrow();
  });

  it("accepts an omitted minimumSeverity", () => {
    const parsed = knowledgeQualityConfigurationSchema.parse({
      id: "cfg-1",
      configurationId: "cfg-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      custom: {},
      createdAt: now,
    });
    expect(parsed.minimumSeverity).toBeUndefined();
  });
});
