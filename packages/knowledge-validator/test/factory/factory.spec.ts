import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { KnowledgeValidatorFactory } from "../../src/factory/knowledge-validator-factory.js";

describe("KnowledgeValidatorFactory", () => {
  const factory = new KnowledgeValidatorFactory();

  it("composes exactly the 6 named sub-factories", () => {
    expect(Object.keys(factory).sort()).toEqual(
      ["validation", "decision", "rule", "finding", "report", "metadata"].sort(),
    );
  });

  describe("validation", () => {
    it("creates a Draft KnowledgeValidation envelope", () => {
      const validation = factory.validation.create({
        token: "kval_1",
        validationId: "v-1",
        tenantId: "t-1",
      });
      expect(validation.state).toBe(KnowledgeValidationState.DRAFT);
      expect(validation.validationId).toBe("v-1");
      expect(validation.token).toBe("kval_1");
    });

    it("carries an optional workspaceId", () => {
      const validation = factory.validation.create({
        token: "kval_1",
        validationId: "v-1",
        tenantId: "t-1",
        workspaceId: "ws-1",
      });
      expect(validation.workspaceId).toBe("ws-1");
    });
  });

  describe("decision", () => {
    it("creates a KnowledgeValidationDecision record", () => {
      const decision = factory.decision.create({
        validationId: "v-1",
        tenantId: "t-1",
        value: KnowledgeValidationDecisionValue.APPROVED,
        reportedBy: "user-1",
      });
      expect(decision.value).toBe(KnowledgeValidationDecisionValue.APPROVED);
      expect(decision.decisionId).toBeDefined();
      expect(decision.recordedAt).toBeDefined();
    });

    it("carries optional confidence/reason", () => {
      const decision = factory.decision.create({
        validationId: "v-1",
        tenantId: "t-1",
        value: KnowledgeValidationDecisionValue.REJECTED,
        reportedBy: "user-1",
        confidence: 0.9,
        reason: "policy violation",
      });
      expect(decision.confidence).toBe(0.9);
      expect(decision.reason).toBe("policy violation");
    });
  });

  describe("rule", () => {
    it("creates a KnowledgeValidationRule record", () => {
      const rule = factory.rule.create({
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
      });
      expect(rule.name).toBe("Rule");
      expect(rule.category).toBe(KnowledgeValidationCategory.SECURITY_VALIDATION);
    });

    it("defaults severity to medium", () => {
      const rule = factory.rule.create({
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
      });
      expect(rule.severity).toBe("medium");
    });

    it("defaults active to true", () => {
      const rule = factory.rule.create({
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
      });
      expect(rule.active).toBe(true);
    });

    it("honors explicit severity/active overrides", () => {
      const rule = factory.rule.create({
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
        severity: "critical",
        active: false,
      });
      expect(rule.severity).toBe("critical");
      expect(rule.active).toBe(false);
    });
  });

  describe("finding", () => {
    it("creates a KnowledgeValidationFinding record", () => {
      const finding = factory.finding.create({
        validationId: "v-1",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
        severity: "high",
        description: "issue found",
      });
      expect(finding.description).toBe("issue found");
      expect(finding.findingId).toBeDefined();
    });

    it("carries optional locationReference/ruleId", () => {
      const finding = factory.finding.create({
        validationId: "v-1",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
        severity: "high",
        description: "issue found",
        locationReference: "loc-1",
        ruleId: "rule-1",
      });
      expect(finding.locationReference).toBe("loc-1");
      expect(finding.ruleId).toBe("rule-1");
    });
  });

  describe("report", () => {
    it("creates a KnowledgeValidationReport record", () => {
      const report = factory.report.create({ validationId: "v-1", tenantId: "t-1" });
      expect(report.reportId).toBeDefined();
      expect(report.findingIds).toEqual([]);
    });

    it("carries findingIds/decisionId/summary", () => {
      const report = factory.report.create({
        validationId: "v-1",
        tenantId: "t-1",
        findingIds: ["f-1"],
        decisionId: "d-1",
        summary: "summary text",
      });
      expect(report.findingIds).toEqual(["f-1"]);
      expect(report.decisionId).toBe("d-1");
      expect(report.summary).toBe("summary text");
    });
  });

  describe("metadata", () => {
    it("creates a KnowledgeValidationMetadata record", () => {
      const metadata = factory.metadata.create({
        validationId: "v-1",
        title: "Title",
        tenantId: "t-1",
      });
      expect(metadata.title).toBe("Title");
      expect(metadata.tags).toEqual([]);
    });

    it("stamps createdBy as updatedBy too", () => {
      const metadata = factory.metadata.create({
        validationId: "v-1",
        title: "Title",
        tenantId: "t-1",
        createdBy: "user-1",
      });
      expect(metadata.createdBy).toBe("user-1");
      expect(metadata.updatedBy).toBe("user-1");
    });

    it("carries optional description/workspaceId/tags", () => {
      const metadata = factory.metadata.create({
        validationId: "v-1",
        title: "Title",
        tenantId: "t-1",
        description: "desc",
        workspaceId: "ws-1",
        tags: ["a", "b"],
      });
      expect(metadata.description).toBe("desc");
      expect(metadata.workspaceId).toBe("ws-1");
      expect(metadata.tags).toEqual(["a", "b"]);
    });
  });
});
