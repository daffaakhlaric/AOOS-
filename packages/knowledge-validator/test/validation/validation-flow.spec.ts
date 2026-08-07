import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import {
  createDraftValidation,
  createReviewingValidation,
  validatorFixture,
} from "../helpers/validator-fixture.js";

describe("KnowledgeValidator — end-to-end flow bookkeeping", () => {
  it("a full Draft -> Approved flow updates Statistics for the declared Category", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator, {
      category: KnowledgeValidationCategory.COMPLIANCE_VALIDATION,
    });
    await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    const snapshot = validator.statistics.get(KnowledgeValidationCategory.COMPLIANCE_VALIDATION);
    expect(snapshot.requestedCount).toBe(1);
    expect(snapshot.approvedCount).toBe(1);
  });

  it("a full Draft -> Rejected flow updates Statistics for the declared Category", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator, {
      category: KnowledgeValidationCategory.BUSINESS_VALIDATION,
    });
    await validator.reject({
      token,
      decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
    });
    const snapshot = validator.statistics.get(KnowledgeValidationCategory.BUSINESS_VALIDATION);
    expect(snapshot.rejectedCount).toBe(1);
  });

  it("history accumulates one entry per lifecycle transition", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    /* queue, prepare, start, review, approve = 5 transitions (create_validation stays in Draft) */
    expect(record.history).toHaveLength(5);
  });

  it("auditTrail accumulates one entry per pipeline-driven operation", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    /* create, queue, prepare, start, review, approve = 6 pipeline runs */
    expect(record.auditTrail).toHaveLength(6);
  });

  it("logs accumulate one structured entry per pipeline-driven operation", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    expect(record.logs).toHaveLength(6);
  });

  it("multiple independent Validations do not interfere with one another", async () => {
    const { validator } = validatorFixture();
    const tokenA = await createDraftValidation(validator);
    const tokenB = await createDraftValidation(validator);
    await validator.cancel({ token: tokenA });
    expect(validator.require(tokenA).state).toBe(KnowledgeValidationState.CANCELLED);
    expect(validator.require(tokenB).state).toBe(KnowledgeValidationState.DRAFT);
  });

  it("createValidation generates a unique token per Validation", async () => {
    const { validator } = validatorFixture();
    const tokenA = await createDraftValidation(validator);
    const tokenB = await createDraftValidation(validator);
    expect(tokenA).not.toBe(tokenB);
  });

  it("a cancelled Validation can still be archived and destroyed", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await validator.cancel({ token });
    const archived = await validator.archive({ token });
    expect(archived.state).toBe(KnowledgeValidationState.ARCHIVED);
    const destroyed = await validator.destroy({ token });
    expect(destroyed.state).toBe(KnowledgeValidationState.DESTROYED);
  });

  it("metrics.snapshot().validationCount increases with every pipeline-driven operation", async () => {
    const { validator } = validatorFixture();
    await createDraftValidation(validator);
    expect(validator.metrics.snapshot().validationCount).toBe(1);
  });

  it("a middleware error propagates and aborts the operation", async () => {
    const { validator } = validatorFixture();
    validator.use(async () => {
      throw new Error("middleware failure");
    });
    await expect(createDraftValidation(validator)).rejects.toThrow("middleware failure");
  });

  it("monitoring.sample() reflects live metrics after operations", async () => {
    const { validator } = validatorFixture();
    await createDraftValidation(validator);
    const dashboard = validator.monitoring.sample();
    expect(dashboard.metrics.validationCount).toBe(1);
  });

  it("health.check() reports healthy registry after at least one registration", async () => {
    const { validator } = validatorFixture();
    await createDraftValidation(validator);
    expect(validator.health.check().registry.status).toBe("healthy");
  });

  it("lifecycle.transitionsFrom mirrors the underlying transition table", () => {
    const { validator } = validatorFixture();
    expect(validator.lifecycle.transitionsFrom(KnowledgeValidationState.DRAFT)).toContain(
      KnowledgeValidationState.QUEUED,
    );
  });

  it("approve() throws when the Validation is not currently Reviewing", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await expect(
      validator.approve({
        token,
        decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
      }),
    ).rejects.toThrow();
  });

  it("reject() throws when the Validation is not currently Reviewing", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await expect(
      validator.reject({
        token,
        decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
      }),
    ).rejects.toThrow();
  });

  it("archive() throws when called on a Draft Validation (illegal transition)", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    await expect(validator.archive({ token })).rejects.toThrow();
  });

  it("destroy() is legal from every settled state", async () => {
    const { validator } = validatorFixture();
    const tokenApproved = await createReviewingValidation(validator);
    await validator.approve({
      token: tokenApproved,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    await expect(validator.destroy({ token: tokenApproved })).resolves.toBeDefined();

    const tokenRejected = await createReviewingValidation(validator);
    await validator.reject({
      token: tokenRejected,
      decision: { value: KnowledgeValidationDecisionValue.REJECTED, reportedBy: "reviewer-1" },
    });
    await expect(validator.destroy({ token: tokenRejected })).resolves.toBeDefined();
  });
});
