import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { ValidatorDecisionException } from "../../src/errors/validator-decision-exception.js";
import { ValidatorFindingException } from "../../src/errors/validator-finding-exception.js";
import { ValidatorNotFoundException } from "../../src/errors/validator-not-found-exception.js";
import { KnowledgeValidatorEventType } from "../../src/events/knowledge-validator-event-type.js";
import {
  createDraftValidation,
  createReviewingValidation,
  validatorFixture,
} from "../helpers/validator-fixture.js";

describe("KnowledgeValidator — Validation Operations", () => {
  it("createValidation creates a Draft KnowledgeValidationRecord", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    const record = validator.require(token);
    expect(record.state).toBe(KnowledgeValidationState.DRAFT);
  });

  it("createValidation publishes ValidationCreated", async () => {
    const { validator, publish } = validatorFixture();
    await createDraftValidation(validator);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_CREATED }),
    );
  });

  it("createValidation registers the Validation into the Registry", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    expect(validator.count()).toBe(1);
    expect(validator.get(token)).toBeDefined();
  });

  it("queue drives Draft -> Queued and publishes ValidationQueued", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createDraftValidation(validator);
    const record = await validator.queue({ token });
    expect(record.state).toBe(KnowledgeValidationState.QUEUED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_QUEUED }),
    );
  });

  it("prepare drives Queued -> Preparing", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await validator.queue({ token });
    const record = await validator.prepare({ token });
    expect(record.state).toBe(KnowledgeValidationState.PREPARING);
  });

  it("start drives Preparing -> Validating and publishes ValidationStarted", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createDraftValidation(validator);
    await validator.queue({ token });
    await validator.prepare({ token });
    const record = await validator.start({ token });
    expect(record.state).toBe(KnowledgeValidationState.VALIDATING);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_STARTED }),
    );
  });

  it("start invokes the configured IKnowledgeValidationProvider and records its findings", async () => {
    const { validator } = validatorFixture({
      provider: {
        validate: async () => ({
          findings: [
            {
              category: KnowledgeValidationCategory.SECURITY_VALIDATION,
              severity: "high",
              description: "issue",
            },
          ],
        }),
      },
    });
    const token = await createDraftValidation(validator);
    await validator.queue({ token });
    await validator.prepare({ token });
    const record = await validator.start({ token });
    expect(record.findings).toHaveLength(1);
  });

  it("start does not invoke any provider when none is configured", async () => {
    const { validator } = validatorFixture();
    expect(validator.hasProvider()).toBe(false);
    const token = await createDraftValidation(validator);
    await validator.queue({ token });
    await validator.prepare({ token });
    const record = await validator.start({ token });
    expect(record.findings).toEqual([]);
  });

  it("review drives Validating -> Reviewing", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await validator.queue({ token });
    await validator.prepare({ token });
    await validator.start({ token });
    const record = await validator.review({ token });
    expect(record.state).toBe(KnowledgeValidationState.REVIEWING);
  });

  it("approve drives Reviewing -> Approved and records the Decision", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    expect(record.state).toBe(KnowledgeValidationState.APPROVED);
    expect(record.decision?.value).toBe(KnowledgeValidationDecisionValue.APPROVED);
  });

  it("approve accepts Conditionally Approved as a legal decision value", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.approve({
      token,
      decision: {
        value: KnowledgeValidationDecisionValue.CONDITIONALLY_APPROVED,
        reportedBy: "reviewer-1",
      },
    });
    expect(record.state).toBe(KnowledgeValidationState.APPROVED);
  });

  it("approve rejects an illegal decision value with ValidatorDecisionException", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await expect(
      validator.approve({
        token,
        decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
      }),
    ).rejects.toThrow(ValidatorDecisionException);
  });

  it("approve publishes DecisionCreated, ValidationCompleted, and ValidationApproved", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.DECISION_CREATED }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_COMPLETED }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_APPROVED }),
    );
  });

  it("approve increments the Approved Count metric", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    expect(validator.metrics.snapshot().approvedCount).toBe(1);
  });

  it("reject drives Reviewing -> Rejected and records the Decision", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.reject({
      token,
      decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
    });
    expect(record.state).toBe(KnowledgeValidationState.REJECTED);
    expect(record.decision?.value).toBe(KnowledgeValidationDecisionValue.REJECTED);
  });

  it("reject accepts Requires Revision as a legal decision value", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.reject({
      token,
      decision: {
        value: KnowledgeValidationDecisionValue.REQUIRES_REVISION,
        reportedBy: "reviewer-1",
      },
    });
    expect(record.state).toBe(KnowledgeValidationState.REJECTED);
  });

  it("reject accepts Requires Review as a legal decision value", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.reject({
      token,
      decision: {
        value: KnowledgeValidationDecisionValue.REQUIRES_REVIEW,
        reportedBy: "reviewer-1",
      },
    });
    expect(record.state).toBe(KnowledgeValidationState.REJECTED);
  });

  it("reject accepts Expired as a legal decision value", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.reject({
      token,
      decision: { value: KnowledgeValidationDecisionValue.EXPIRED, reportedBy: "reviewer-1" },
    });
    expect(record.state).toBe(KnowledgeValidationState.REJECTED);
  });

  it("reject rejects an illegal decision value with ValidatorDecisionException", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await expect(
      validator.reject({
        token,
        decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
      }),
    ).rejects.toThrow(ValidatorDecisionException);
  });

  it("reject publishes DecisionCreated, ValidationCompleted, and ValidationRejected", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.reject({
      token,
      decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_REJECTED }),
    );
  });

  it("reject increments the Rejected Count metric", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.reject({
      token,
      decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
    });
    expect(validator.metrics.snapshot().rejectedCount).toBe(1);
  });

  it("cancel drives a Draft Validation to Cancelled", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createDraftValidation(validator);
    const record = await validator.cancel({ token });
    expect(record.state).toBe(KnowledgeValidationState.CANCELLED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_CANCELLED }),
    );
  });

  it("archive drives an Approved Validation to Archived", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    const record = await validator.archive({ token });
    expect(record.state).toBe(KnowledgeValidationState.ARCHIVED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_ARCHIVED }),
    );
  });

  it("archive drives a Rejected Validation to Archived", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.reject({
      token,
      decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
    });
    const record = await validator.archive({ token });
    expect(record.state).toBe(KnowledgeValidationState.ARCHIVED);
  });

  it("destroy drives any settled state to Destroyed", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createDraftValidation(validator);
    await validator.cancel({ token });
    const record = await validator.destroy({ token });
    expect(record.state).toBe(KnowledgeValidationState.DESTROYED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.VALIDATION_DESTROYED }),
    );
  });

  it("every lifecycle operation throws ValidatorNotFoundException for an unknown token", async () => {
    const { validator } = validatorFixture();
    await expect(validator.queue({ token: "unknown" })).rejects.toThrow(ValidatorNotFoundException);
    await expect(validator.prepare({ token: "unknown" })).rejects.toThrow(
      ValidatorNotFoundException,
    );
    await expect(validator.start({ token: "unknown" })).rejects.toThrow(ValidatorNotFoundException);
    await expect(validator.review({ token: "unknown" })).rejects.toThrow(
      ValidatorNotFoundException,
    );
    await expect(validator.cancel({ token: "unknown" })).rejects.toThrow(
      ValidatorNotFoundException,
    );
    await expect(validator.archive({ token: "unknown" })).rejects.toThrow(
      ValidatorNotFoundException,
    );
    await expect(validator.destroy({ token: "unknown" })).rejects.toThrow(
      ValidatorNotFoundException,
    );
  });
});

describe("KnowledgeValidator — Finding Operations", () => {
  it("recordFinding attaches a Finding while Validating", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await validator.queue({ token });
    await validator.prepare({ token });
    await validator.start({ token });
    const record = await validator.recordFinding({
      token,
      category: KnowledgeValidationCategory.SECURITY_VALIDATION,
      severity: "high",
      description: "issue",
    });
    expect(record.findings).toHaveLength(1);
  });

  it("recordFinding attaches a Finding while Reviewing", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.recordFinding({
      token,
      category: KnowledgeValidationCategory.SECURITY_VALIDATION,
      severity: "high",
      description: "issue",
    });
    expect(record.findings).toHaveLength(1);
  });

  it("recordFinding throws ValidatorFindingException outside Validating/Reviewing", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await expect(
      validator.recordFinding({
        token,
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
        severity: "high",
        description: "issue",
      }),
    ).rejects.toThrow(ValidatorFindingException);
  });

  it("recordFinding increments the Finding metric", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.recordFinding({
      token,
      category: KnowledgeValidationCategory.SECURITY_VALIDATION,
      severity: "high",
      description: "issue",
    });
    expect(validator.metrics.snapshot().findingCount).toBe(1);
  });

  it("recordFinding throws ValidatorNotFoundException for an unknown token", async () => {
    const { validator } = validatorFixture();
    await expect(
      validator.recordFinding({
        token: "unknown",
        category: KnowledgeValidationCategory.SECURITY_VALIDATION,
        severity: "high",
        description: "issue",
      }),
    ).rejects.toThrow(ValidatorNotFoundException);
  });
});

describe("KnowledgeValidator — Report Operations", () => {
  it("generateReport builds a report aggregating recorded Findings", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.recordFinding({
      token,
      category: KnowledgeValidationCategory.SECURITY_VALIDATION,
      severity: "high",
      description: "issue",
    });
    const result = await validator.generateReport({ token });
    expect(result.report.findingIds).toHaveLength(1);
  });

  it("generateReport carries the settled Decision id when present", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    const result = await validator.generateReport({ token });
    expect(result.report.decisionId).toBeDefined();
  });

  it("generateReport publishes ReportGenerated", async () => {
    const { validator, publish } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.generateReport({ token });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeValidatorEventType.REPORT_GENERATED }),
    );
  });

  it("generateReport carries the optional summary", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const result = await validator.generateReport({ token, summary: "all good" });
    expect(result.report.summary).toBe("all good");
  });

  it("generateReport throws ValidatorNotFoundException for an unknown token", async () => {
    const { validator } = validatorFixture();
    await expect(validator.generateReport({ token: "unknown" })).rejects.toThrow(
      ValidatorNotFoundException,
    );
  });
});
