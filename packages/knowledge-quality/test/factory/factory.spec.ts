import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { KnowledgeQualityFactory } from "../../src/factory/knowledge-quality-factory.js";

describe("KnowledgeQualityFactory", () => {
  const factory = new KnowledgeQualityFactory();

  it("composes exactly the 6 named sub-factories", () => {
    expect(factory.assessment).toBeDefined();
    expect(factory.finding).toBeDefined();
    expect(factory.rule).toBeDefined();
    expect(factory.profile).toBeDefined();
    expect(factory.report).toBeDefined();
    expect(factory.metadata).toBeDefined();
  });

  describe("AssessmentFactory", () => {
    it("creates a Draft KnowledgeQualityAssessment", () => {
      const assessment = factory.assessment.create({
        token: "kqua_1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
      });
      expect(assessment.state).toBe(KnowledgeQualityAssessmentState.DRAFT);
      expect(assessment.id).toBe("g-1");
    });

    it("carries an optional workspaceId", () => {
      const assessment = factory.assessment.create({
        token: "kqua_1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
      });
      expect(assessment.workspaceId).toBe("workspace-1");
    });
  });

  describe("FindingFactory", () => {
    it("creates a Finding with a generated findingId", () => {
      const finding = factory.finding.create({
        assessmentId: "g-1",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.ACCURACY,
        severity: "high",
        description: "issue",
      });
      expect(finding.findingId).toBeDefined();
      expect(finding.dimension).toBe(KnowledgeQualityDimension.ACCURACY);
      expect(finding.severity).toBe("high");
    });

    it("carries optional locationReference/ruleId", () => {
      const finding = factory.finding.create({
        assessmentId: "g-1",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.ACCURACY,
        severity: "low",
        description: "issue",
        locationReference: "line-1",
        ruleId: "rule-1",
      });
      expect(finding.locationReference).toBe("line-1");
      expect(finding.ruleId).toBe("rule-1");
    });
  });

  describe("RuleFactory", () => {
    it("defaults severity to medium and active to true", () => {
      const rule = factory.rule.create({
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.CLARITY,
      });
      expect(rule.severity).toBe("medium");
      expect(rule.active).toBe(true);
    });

    it("honors caller-supplied severity/active", () => {
      const rule = factory.rule.create({
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "tenant-1",
        dimension: KnowledgeQualityDimension.CLARITY,
        severity: "critical",
        active: false,
      });
      expect(rule.severity).toBe("critical");
      expect(rule.active).toBe(false);
    });
  });

  describe("ProfileFactory", () => {
    it("defaults ruleIds/dimensionWeights to empty when absent", () => {
      const profile = factory.profile.create({
        profileId: "profile-1",
        name: "Profile",
        tenantId: "tenant-1",
      });
      expect(profile.ruleIds).toEqual([]);
      expect(profile.dimensionWeights).toEqual({});
    });

    it("carries the given ruleIds and dimensionWeights", () => {
      const profile = factory.profile.create({
        profileId: "profile-1",
        name: "Profile",
        tenantId: "tenant-1",
        ruleIds: ["rule-1"],
        dimensionWeights: { [KnowledgeQualityDimension.ACCURACY]: 0.5 },
      });
      expect(profile.ruleIds).toEqual(["rule-1"]);
      expect(profile.dimensionWeights[KnowledgeQualityDimension.ACCURACY]).toBe(0.5);
    });
  });

  describe("ReportFactory", () => {
    it("creates a Report with a generated reportId", () => {
      const report = factory.report.create({
        assessmentId: "g-1",
        tenantId: "tenant-1",
      });
      expect(report.reportId).toBeDefined();
      expect(report.findingIds).toEqual([]);
      expect(report.scoreMetadataIds).toEqual([]);
    });

    it("carries findingIds/scoreMetadataIds/summary", () => {
      const report = factory.report.create({
        assessmentId: "g-1",
        tenantId: "tenant-1",
        findingIds: ["f-1"],
        scoreMetadataIds: ["s-1"],
        summary: "summary text",
      });
      expect(report.findingIds).toEqual(["f-1"]);
      expect(report.scoreMetadataIds).toEqual(["s-1"]);
      expect(report.summary).toBe("summary text");
    });
  });

  describe("MetadataFactory", () => {
    it("creates a KnowledgeQualityAssessmentMetadata record", () => {
      const metadata = factory.metadata.create({
        assessmentId: "g-1",
        title: "Title",
        tenantId: "tenant-1",
      });
      expect(metadata.title).toBe("Title");
      expect(metadata.tags).toEqual([]);
    });

    it("mirrors createdBy onto updatedBy", () => {
      const metadata = factory.metadata.create({
        assessmentId: "g-1",
        title: "Title",
        tenantId: "tenant-1",
        createdBy: "user-1",
      });
      expect(metadata.createdBy).toBe("user-1");
      expect(metadata.updatedBy).toBe("user-1");
    });
  });
});
