import { describe, expect, it } from "vitest";

import { AssessmentValidationException } from "../../src/errors/assessment-validation-exception.js";
import { DuplicateQualityEntryException } from "../../src/errors/duplicate-quality-entry-exception.js";
import { IllegalAssessmentTransitionException } from "../../src/errors/illegal-assessment-transition-exception.js";
import { InvalidAssessmentMetadataException } from "../../src/errors/invalid-assessment-metadata-exception.js";
import { KnowledgeQualityException } from "../../src/errors/knowledge-quality-exception.js";
import { QualityConfigurationException } from "../../src/errors/quality-configuration-exception.js";
import { QualityFindingException } from "../../src/errors/quality-finding-exception.js";
import { QualityLeaseException } from "../../src/errors/quality-lease-exception.js";
import { QualityNotFoundException } from "../../src/errors/quality-not-found-exception.js";
import { QualityOperationException } from "../../src/errors/quality-operation-exception.js";
import { QualityPolicyException } from "../../src/errors/quality-policy-exception.js";
import { QualityProfileException } from "../../src/errors/quality-profile-exception.js";
import { QualityRuleException } from "../../src/errors/quality-rule-exception.js";
import { QualitySessionException } from "../../src/errors/quality-session-exception.js";

const EXCEPTIONS = [
  DuplicateQualityEntryException,
  AssessmentValidationException,
  QualityConfigurationException,
  QualityFindingException,
  QualityLeaseException,
  QualityNotFoundException,
  QualityOperationException,
  QualityPolicyException,
  QualityProfileException,
  QualityRuleException,
  QualitySessionException,
  IllegalAssessmentTransitionException,
  InvalidAssessmentMetadataException,
];

describe("Knowledge Quality error hierarchy", () => {
  it("KnowledgeQualityException carries the message", () => {
    const error = new KnowledgeQualityException("boom");
    expect(error.message).toBe("boom");
  });

  it("KnowledgeQualityException accepts cause/context options", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeQualityException("boom", { cause, context: { key: "value" } });
    expect(error.cause).toBe(cause);
  });

  it.each(EXCEPTIONS)("%s extends KnowledgeQualityException", (ExceptionClass) => {
    const error = new ExceptionClass("message");
    expect(error).toBeInstanceOf(KnowledgeQualityException);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("message");
  });

  it.each(EXCEPTIONS)("%s is throwable and catchable", (ExceptionClass) => {
    expect(() => {
      throw new ExceptionClass("thrown");
    }).toThrow(ExceptionClass);
  });
});
