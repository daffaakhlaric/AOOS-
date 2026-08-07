import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { knowledgeValidationConfigurationSchema } from "../../src/domain/knowledge-validation-configuration.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { knowledgeValidationDecisionSchema } from "../../src/domain/knowledge-validation-decision.js";
import {
  KNOWLEDGE_VALIDATION_FINDING_SEVERITIES,
  knowledgeValidationFindingSchema,
} from "../../src/domain/knowledge-validation-finding.js";
import { knowledgeValidationRuleSchema } from "../../src/domain/knowledge-validation-rule.js";

const now = "2026-01-01T00:00:00.000Z";

describe("knowledgeValidationConfigurationSchema — minimumSeverity + custom", () => {
  it.each(KNOWLEDGE_VALIDATION_FINDING_SEVERITIES)("accepts minimumSeverity = %s", (severity) => {
    expect(() =>
      knowledgeValidationConfigurationSchema.parse({
        id: "c-1",
        configurationId: "c-1",
        validationId: "v-1",
        tenantId: "t-1",
        minimumSeverity: severity,
        custom: {},
        createdAt: now,
      }),
    ).not.toThrow();
  });

  it("carries arbitrary custom fields", () => {
    const configuration = knowledgeValidationConfigurationSchema.parse({
      id: "c-1",
      configurationId: "c-1",
      validationId: "v-1",
      tenantId: "t-1",
      custom: { foo: "bar", n: 1 },
      createdAt: now,
    });
    expect(configuration.custom).toEqual({ foo: "bar", n: 1 });
  });

  it("accepts retries at the boundary of 0 and 10", () => {
    for (const retries of [0, 10]) {
      expect(() =>
        knowledgeValidationConfigurationSchema.parse({
          id: "c-1",
          configurationId: "c-1",
          validationId: "v-1",
          tenantId: "t-1",
          retries,
          custom: {},
          createdAt: now,
        }),
      ).not.toThrow();
    }
  });
});

describe("knowledgeValidationDecisionSchema — every legal decision value", () => {
  it.each(Object.values(KnowledgeValidationDecisionValue))("accepts value = %s", (value) => {
    expect(() =>
      knowledgeValidationDecisionSchema.parse({
        id: "d-1",
        decisionId: "d-1",
        validationId: "v-1",
        tenantId: "t-1",
        value,
        reportedBy: "user-1",
        recordedAt: now,
      }),
    ).not.toThrow();
  });

  it("accepts confidence at the boundaries 0 and 1", () => {
    for (const confidence of [0, 1]) {
      expect(() =>
        knowledgeValidationDecisionSchema.parse({
          id: "d-1",
          decisionId: "d-1",
          validationId: "v-1",
          tenantId: "t-1",
          value: KnowledgeValidationDecisionValue.APPROVED,
          reportedBy: "user-1",
          confidence,
          recordedAt: now,
        }),
      ).not.toThrow();
    }
  });

  it("rejects a negative confidence", () => {
    expect(() =>
      knowledgeValidationDecisionSchema.parse({
        id: "d-1",
        decisionId: "d-1",
        validationId: "v-1",
        tenantId: "t-1",
        value: KnowledgeValidationDecisionValue.APPROVED,
        reportedBy: "user-1",
        confidence: -0.1,
        recordedAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeValidationFindingSchema — every severity and category", () => {
  it.each(KNOWLEDGE_VALIDATION_FINDING_SEVERITIES)("accepts severity = %s", (severity) => {
    expect(() =>
      knowledgeValidationFindingSchema.parse({
        id: "f-1",
        findingId: "f-1",
        validationId: "v-1",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
        severity,
        description: "issue",
        createdAt: now,
      }),
    ).not.toThrow();
  });

  it.each(Object.values(KnowledgeValidationCategory))("accepts category = %s", (category) => {
    expect(() =>
      knowledgeValidationFindingSchema.parse({
        id: "f-1",
        findingId: "f-1",
        validationId: "v-1",
        tenantId: "t-1",
        category,
        severity: "medium",
        description: "issue",
        createdAt: now,
      }),
    ).not.toThrow();
  });

  it("rejects an unknown severity", () => {
    expect(() =>
      knowledgeValidationFindingSchema.parse({
        id: "f-1",
        findingId: "f-1",
        validationId: "v-1",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
        severity: "unknown",
        description: "issue",
        createdAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeValidationRuleSchema — every category", () => {
  it.each(Object.values(KnowledgeValidationCategory))("accepts category = %s", (category) => {
    expect(() =>
      knowledgeValidationRuleSchema.parse({
        id: "rule-1",
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "t-1",
        category,
        createdAt: now,
        updatedAt: now,
      }),
    ).not.toThrow();
  });

  it.each(KNOWLEDGE_VALIDATION_FINDING_SEVERITIES)("accepts severity = %s", (severity) => {
    expect(() =>
      knowledgeValidationRuleSchema.parse({
        id: "rule-1",
        ruleId: "rule-1",
        name: "Rule",
        tenantId: "t-1",
        category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
        severity,
        createdAt: now,
        updatedAt: now,
      }),
    ).not.toThrow();
  });
});
