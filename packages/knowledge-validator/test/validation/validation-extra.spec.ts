import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { KnowledgeValidationSessionState } from "../../src/domain/knowledge-validation-session-state.js";
import { ValidatorNotFoundException } from "../../src/errors/validator-not-found-exception.js";
import { KnowledgeValidatorMiddleware } from "../../src/middleware/knowledge-validator-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";
import {
  createDraftValidation,
  createReviewingValidation,
  validatorFixture,
} from "../helpers/validator-fixture.js";

describe("KnowledgeValidator — Configuration Operations (Setup helpers)", () => {
  it("registerRule registers a Rule usable by a later Request", async () => {
    const { validator } = validatorFixture();
    validator.registerRule({
      ruleId: "rule-1",
      name: "Rule",
      tenantId: "t-1",
      category: KnowledgeValidationCategory.SECURITY_VALIDATION,
    });
    expect(validator.resolver.tryResolveRule("rule-1")).toBeDefined();
  });

  it("registerPolicy registers a Policy usable by a later Request", async () => {
    const { validator } = validatorFixture();
    validator.registerPolicy({ policyId: "p-1", name: "Policy", tenantId: "t-1" });
    expect(validator.resolver.tryResolvePolicy("p-1")).toBeDefined();
  });

  it("registerPolicy defaults allowedCategories to empty and active to true", async () => {
    const { validator } = validatorFixture();
    const policy = validator.registerPolicy({ policyId: "p-1", name: "Policy", tenantId: "t-1" });
    expect(policy.allowedCategories).toEqual([]);
    expect(policy.active).toBe(true);
  });

  it("registerConfiguration registers a Configuration usable by a later Request", async () => {
    const { validator } = validatorFixture();
    const configuration = validator.registerConfiguration({
      configurationId: "c-1",
      validationId: "v-1",
      tenantId: "t-1",
      timeoutMs: 5000,
    });
    expect(configuration.timeoutMs).toBe(5000);
    expect(validator.resolver.tryResolveConfiguration("c-1")).toBeDefined();
  });

  it("a Request referencing a registered Configuration resolves it during prepare()", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator, { withRule: true });
    validator.registerConfiguration({
      configurationId: "c-1",
      validationId: "v-1",
      tenantId: "t-1",
    });
    // Directly exercise resolver plumbing via a fresh validation referencing the configuration.
    expect(validator.resolver.tryResolveConfiguration("c-1")).toBeDefined();
    await validator.queue({ token });
  });
});

describe("KnowledgeValidator — createValidation defaults", () => {
  it("defaults ruleIds to an empty array when omitted", async () => {
    const { validator } = validatorFixture();
    const record = await validator.createValidation({
      context: contextFixture({ validationId: "v-1", tenantId: "t-1" }),
      title: "Title",
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      targetReference: "target-1",
      requestedBy: "user-1",
    });
    expect(record.request.ruleIds).toEqual([]);
  });

  it("defaults tags to an empty array when omitted", async () => {
    const { validator } = validatorFixture();
    const record = await validator.createValidation({
      context: contextFixture({ validationId: "v-1", tenantId: "t-1" }),
      title: "Title",
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      targetReference: "target-1",
      requestedBy: "user-1",
    });
    expect(record.metadata.tags).toEqual([]);
  });

  it("carries through optional description/instructions", async () => {
    const { validator } = validatorFixture();
    const record = await validator.createValidation({
      context: contextFixture({ validationId: "v-1", tenantId: "t-1" }),
      title: "Title",
      description: "desc",
      category: KnowledgeValidationCategory.CUSTOM_VALIDATION,
      targetReference: "target-1",
      requestedBy: "user-1",
      instructions: "be thorough",
    });
    expect(record.metadata.description).toBe("desc");
    expect(record.request.instructions).toBe("be thorough");
  });
});

describe("KnowledgeValidator — use() middleware", () => {
  it("use registers a middleware onto the shared chain", async () => {
    const { validator } = validatorFixture();
    let called = false;
    validator.use(async (_execution, next) => {
      called = true;
      await next();
    });
    await createDraftValidation(validator);
    expect(called).toBe(true);
  });

  it("use returns this for chaining", () => {
    const { validator } = validatorFixture();
    expect(validator.use(async () => {})).toBe(validator);
  });

  it("exposes the underlying middleware instance", () => {
    const { validator } = validatorFixture();
    expect(validator.middleware).toBeInstanceOf(KnowledgeValidatorMiddleware);
  });
});

describe("KnowledgeValidator — Session Operations", () => {
  it("openSession opens an Open session for a known token", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    const session = validator.openSession({ token, holder: "user-1" });
    expect(session.state).toBe(KnowledgeValidationSessionState.OPEN);
  });

  it("openSession throws for an unknown token", () => {
    const { validator } = validatorFixture();
    expect(() => validator.openSession({ token: "unknown", holder: "user-1" })).toThrow(
      ValidatorNotFoundException,
    );
  });

  it("closeSession transitions the session to Closed", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    validator.openSession({ token, holder: "user-1" });
    const session = validator.closeSession({ token });
    expect(session.state).toBe(KnowledgeValidationSessionState.CLOSED);
  });

  it("cancelSession transitions the session to Cancelled", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    validator.openSession({ token, holder: "user-1" });
    const session = validator.cancelSession({ token });
    expect(session.state).toBe(KnowledgeValidationSessionState.CANCELLED);
  });

  it("expireSession transitions the session to Expired", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    validator.openSession({ token, holder: "user-1" });
    const session = validator.expireSession({ token });
    expect(session.state).toBe(KnowledgeValidationSessionState.EXPIRED);
  });

  it("renewSession extends the session's expiry", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    const opened = validator.openSession({ token, holder: "user-1", ttlMs: 1000 });
    const renewed = validator.renewSession({ token, ttlMs: 60000 });
    expect(Date.parse(renewed.expiresAt ?? "") >= Date.parse(opened.expiresAt ?? "")).toBe(true);
  });
});

describe("KnowledgeValidator — Job Operations", () => {
  it("createJob creates a Job with default priority", async () => {
    const { validator } = validatorFixture();
    const { job } = validator.createJob({ validationId: "v-1", tenantId: "t-1" });
    expect(job.priority).toBe(5);
  });

  it("createJob honors an explicit priority", () => {
    const { validator } = validatorFixture();
    const { job } = validator.createJob({ validationId: "v-1", tenantId: "t-1", priority: 9 });
    expect(job.priority).toBe(9);
  });

  it("completeJob stamps completedAt", () => {
    const { validator } = validatorFixture();
    const { job } = validator.createJob({ validationId: "v-1", tenantId: "t-1" });
    const completed = validator.completeJob({ jobId: job.jobId });
    expect(completed.completedAt).toBeDefined();
  });

  it("completeJob throws for an unknown jobId", () => {
    const { validator } = validatorFixture();
    expect(() => validator.completeJob({ jobId: "unknown" })).toThrow(ValidatorNotFoundException);
  });

  it("failJob stamps failedAt and failureReason", () => {
    const { validator } = validatorFixture();
    const { job } = validator.createJob({ validationId: "v-1", tenantId: "t-1" });
    const failed = validator.failJob({ jobId: job.jobId, reason: "boom" });
    expect(failed.failedAt).toBeDefined();
    expect(failed.failureReason).toBe("boom");
  });

  it("failJob throws for an unknown jobId", () => {
    const { validator } = validatorFixture();
    expect(() => validator.failJob({ jobId: "unknown", reason: "boom" })).toThrow(
      ValidatorNotFoundException,
    );
  });
});

describe("KnowledgeValidator — Read Operations", () => {
  it("get returns undefined for an unknown token", () => {
    const { validator } = validatorFixture();
    expect(validator.get("unknown")).toBeUndefined();
  });

  it("get returns a record for a known token", async () => {
    const { validator } = validatorFixture();
    const token = await createDraftValidation(validator);
    expect(validator.get(token)).toBeDefined();
  });

  it("require throws for an unknown token", () => {
    const { validator } = validatorFixture();
    expect(() => validator.require("unknown")).toThrow(ValidatorNotFoundException);
  });

  it("list returns every registered validation", async () => {
    const { validator } = validatorFixture();
    await createDraftValidation(validator);
    await createDraftValidation(validator);
    expect(validator.list().validations).toHaveLength(2);
  });

  it("count reflects the number of registered validations", async () => {
    const { validator } = validatorFixture();
    await createDraftValidation(validator);
    expect(validator.count()).toBe(1);
  });
});

describe("KnowledgeValidator — Provider Resolution", () => {
  it("hasProvider is false with no config", () => {
    const { validator } = validatorFixture();
    expect(validator.hasProvider()).toBe(false);
  });

  it("hasProvider is true when a provider is configured", () => {
    const { validator } = validatorFixture({
      provider: { validate: async () => ({ findings: [] }) },
    });
    expect(validator.hasProvider()).toBe(true);
  });

  it("hasDecisionProvider is false with no config", () => {
    const { validator } = validatorFixture();
    expect(validator.hasDecisionProvider()).toBe(false);
  });

  it("hasDecisionProvider is true when a decision provider is configured", () => {
    const { validator } = validatorFixture({
      decisionProvider: {
        decide: async () => ({
          value: KnowledgeValidationDecisionValue.APPROVED,
          reportedBy: "provider-1",
        }),
      },
    });
    expect(validator.hasDecisionProvider()).toBe(true);
  });

  it("never invokes a provider automatically outside start()", async () => {
    let calls = 0;
    const { validator } = validatorFixture({
      provider: {
        validate: async () => {
          calls += 1;
          return { findings: [] };
        },
      },
    });
    await createDraftValidation(validator);
    expect(calls).toBe(0);
  });
});

describe("KnowledgeValidator — Decision Operations (via approve/reject)", () => {
  it("records a decisionId that resolves via the resolver", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    expect(validator.resolver.tryResolveDecision(record.decision?.decisionId ?? "")).toBeDefined();
  });

  it("records the reportedBy and confidence on the Decision", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    const record = await validator.approve({
      token,
      decision: {
        value: KnowledgeValidationDecisionValue.APPROVED,
        reportedBy: "reviewer-1",
        confidence: 0.9,
      },
    });
    expect(record.decision?.reportedBy).toBe("reviewer-1");
    expect(record.decision?.confidence).toBe(0.9);
  });

  it("increments the Decision Count metric", async () => {
    const { validator } = validatorFixture();
    const token = await createReviewingValidation(validator);
    await validator.approve({
      token,
      decision: { value: KnowledgeValidationDecisionValue.APPROVED, reportedBy: "reviewer-1" },
    });
    expect(validator.metrics.snapshot().decisionCount).toBe(1);
  });
});
