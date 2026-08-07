import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import {
  APPROVAL_DECISION_VALUES,
  KnowledgeValidationDecisionValue,
  REJECTION_DECISION_VALUES,
} from "../../src/domain/knowledge-validation-decision-value.js";
import { KnowledgeValidationSessionState } from "../../src/domain/knowledge-validation-session-state.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";

describe("KnowledgeValidationCategory", () => {
  it("has exactly 9 categories", () => {
    expect(Object.values(KnowledgeValidationCategory)).toHaveLength(9);
  });

  it.each([
    ["POLICY_VALIDATION", "policy_validation"],
    ["STRUCTURE_VALIDATION", "structure_validation"],
    ["METADATA_VALIDATION", "metadata_validation"],
    ["REFERENCE_VALIDATION", "reference_validation"],
    ["COMPLIANCE_VALIDATION", "compliance_validation"],
    ["SECURITY_VALIDATION", "security_validation"],
    ["BUSINESS_VALIDATION", "business_validation"],
    ["QUALITY_VALIDATION", "quality_validation"],
    ["CUSTOM_VALIDATION", "custom_validation"],
  ])("has %s = %s", (key, value) => {
    expect(KnowledgeValidationCategory[key as keyof typeof KnowledgeValidationCategory]).toBe(
      value,
    );
  });
});

describe("KnowledgeValidationDecisionValue", () => {
  it("has exactly 6 decision values", () => {
    expect(Object.values(KnowledgeValidationDecisionValue)).toHaveLength(6);
  });

  it.each([
    ["APPROVED", "approved"],
    ["CONDITIONALLY_APPROVED", "conditionally_approved"],
    ["REQUIRES_REVIEW", "requires_review"],
    ["REQUIRES_REVISION", "requires_revision"],
    ["REJECTED", "rejected"],
    ["EXPIRED", "expired"],
  ])("has %s = %s", (key, value) => {
    expect(
      KnowledgeValidationDecisionValue[key as keyof typeof KnowledgeValidationDecisionValue],
    ).toBe(value);
  });

  it("APPROVAL_DECISION_VALUES contains exactly Approved and Conditionally Approved", () => {
    expect(APPROVAL_DECISION_VALUES.size).toBe(2);
    expect(APPROVAL_DECISION_VALUES.has(KnowledgeValidationDecisionValue.APPROVED)).toBe(true);
    expect(
      APPROVAL_DECISION_VALUES.has(KnowledgeValidationDecisionValue.CONDITIONALLY_APPROVED),
    ).toBe(true);
  });

  it("REJECTION_DECISION_VALUES contains exactly the 4 non-approval values", () => {
    expect(REJECTION_DECISION_VALUES.size).toBe(4);
    expect(REJECTION_DECISION_VALUES.has(KnowledgeValidationDecisionValue.REJECTED)).toBe(true);
    expect(REJECTION_DECISION_VALUES.has(KnowledgeValidationDecisionValue.REQUIRES_REVISION)).toBe(
      true,
    );
    expect(REJECTION_DECISION_VALUES.has(KnowledgeValidationDecisionValue.REQUIRES_REVIEW)).toBe(
      true,
    );
    expect(REJECTION_DECISION_VALUES.has(KnowledgeValidationDecisionValue.EXPIRED)).toBe(true);
  });

  it("APPROVAL_DECISION_VALUES and REJECTION_DECISION_VALUES are disjoint", () => {
    for (const value of APPROVAL_DECISION_VALUES) {
      expect(REJECTION_DECISION_VALUES.has(value)).toBe(false);
    }
  });

  it("APPROVAL_DECISION_VALUES + REJECTION_DECISION_VALUES cover all 6 values", () => {
    const union = new Set([...APPROVAL_DECISION_VALUES, ...REJECTION_DECISION_VALUES]);
    expect(union.size).toBe(6);
  });
});

describe("KnowledgeValidationSessionState", () => {
  it("has exactly 4 states", () => {
    expect(Object.values(KnowledgeValidationSessionState)).toHaveLength(4);
  });

  it.each([
    ["OPEN", "open"],
    ["CLOSED", "closed"],
    ["CANCELLED", "cancelled"],
    ["EXPIRED", "expired"],
  ])("has %s = %s", (key, value) => {
    expect(
      KnowledgeValidationSessionState[key as keyof typeof KnowledgeValidationSessionState],
    ).toBe(value);
  });
});

describe("KnowledgeValidationState", () => {
  it("has exactly 10 states", () => {
    expect(Object.values(KnowledgeValidationState)).toHaveLength(10);
  });

  it.each([
    ["DRAFT", "draft"],
    ["QUEUED", "queued"],
    ["PREPARING", "preparing"],
    ["VALIDATING", "validating"],
    ["REVIEWING", "reviewing"],
    ["APPROVED", "approved"],
    ["REJECTED", "rejected"],
    ["CANCELLED", "cancelled"],
    ["ARCHIVED", "archived"],
    ["DESTROYED", "destroyed"],
  ])("has %s = %s", (key, value) => {
    expect(KnowledgeValidationState[key as keyof typeof KnowledgeValidationState]).toBe(value);
  });
});
