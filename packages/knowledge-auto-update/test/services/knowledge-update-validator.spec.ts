import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdateResult } from "../../src/entities/knowledge-update-result.js";
import { ValidationFailedException } from "../../src/errors/validation-failed-exception.js";
import { KnowledgeUpdateValidator } from "../../src/services/knowledge-update-validator.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";

describe("KnowledgeUpdateValidator", () => {
  beforeEach(resetFixtureState);
  const validator = new KnowledgeUpdateValidator();

  describe("validateJob", () => {
    it("passes for a well-formed job", () => {
      const result = validator.validateJob(makeJob());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("fails for empty targetId", () => {
      const result = validator.validateJob(makeJob({ targetId: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("targetId must not be empty");
    });

    it("fails for empty policyId", () => {
      const result = validator.validateJob(makeJob({ policyId: "" }));
      expect(result.errors).toContain("policyId must not be empty");
    });

    it("fails when a job depends on itself", () => {
      const job = makeJob({ id: "self", dependsOn: ["self"] });
      const result = validator.validateJob(job);
      expect(result.errors).toContain("job cannot depend on itself");
    });

    it("fails when dependsOn has duplicates", () => {
      const job = makeJob({ dependsOn: ["a", "a"] });
      const result = validator.validateJob(job);
      expect(result.errors).toContain("dependsOn must not contain duplicates");
    });

    it("fails for a non-positive interval schedule", () => {
      const job = makeJob({ schedule: { kind: ScheduleKind.Interval, intervalMs: 0, startAt: 0 } });
      const result = validator.validateJob(job);
      expect(result.errors).toContain("interval schedule intervalMs must be > 0");
    });

    it("passes for a valid cron schedule", () => {
      const job = makeJob({ schedule: { kind: ScheduleKind.Cron, expression: "* * * * *" } });
      expect(validator.validateJob(job).valid).toBe(true);
    });

    it("passes for an immediate schedule", () => {
      const job = makeJob({ schedule: { kind: ScheduleKind.Immediate } });
      expect(validator.validateJob(job).valid).toBe(true);
    });

    it("passes for a scheduled (one-shot) schedule regardless of runAt value", () => {
      const job = makeJob({ schedule: { kind: ScheduleKind.Scheduled, runAt: -500 } });
      expect(validator.validateJob(job).valid).toBe(true);
    });

    it("passes for a valid positive interval schedule", () => {
      const job = makeJob({ schedule: { kind: ScheduleKind.Interval, intervalMs: 1, startAt: 0 } });
      expect(validator.validateJob(job).valid).toBe(true);
    });

    it("accumulates multiple distinct errors at once", () => {
      const job = makeJob({ targetId: "", policyId: "" });
      const result = validator.validateJob(job);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("fails for an invalid cron schedule", () => {
      const job = makeJob({ schedule: { kind: ScheduleKind.Cron, expression: "* * * *" } });
      const result = validator.validateJob(job);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("validateJobOrThrow throws ValidationFailedException on invalid job", () => {
      const job = makeJob({ targetId: "" });
      expect(() => validator.validateJobOrThrow(job)).toThrow(ValidationFailedException);
    });

    it("validateJobOrThrow does not throw for a valid job", () => {
      expect(() => validator.validateJobOrThrow(makeJob())).not.toThrow();
    });
  });

  describe("validateResult", () => {
    function makeResult(
      overrides: Partial<ConstructorParameters<typeof KnowledgeUpdateResult>[0]> = {},
    ) {
      return new KnowledgeUpdateResult({
        id: "r-1",
        taskId: "t-1",
        jobId: "j-1",
        success: true,
        appliedPayload: { a: 1 },
        errorMessage: undefined,
        durationMs: 0,
        completedAt: 0,
        ...overrides,
      });
    }

    it("passes for a well-formed successful result", () => {
      expect(validator.validateResult(makeResult()).valid).toBe(true);
    });

    it("passes for a well-formed failed result", () => {
      const result = makeResult({ success: false, appliedPayload: undefined, errorMessage: "x" });
      expect(validator.validateResult(result).valid).toBe(true);
    });

    it("fails when a successful result is missing appliedPayload", () => {
      const result = makeResult({ appliedPayload: undefined });
      expect(validator.validateResult(result).errors).toContain(
        "successful result must include appliedPayload",
      );
    });

    it("fails when a failed result is missing errorMessage", () => {
      const result = makeResult({ success: false, appliedPayload: undefined });
      expect(validator.validateResult(result).errors).toContain(
        "failed result must include errorMessage",
      );
    });

    it("validateResultOrThrow throws on an invalid result", () => {
      const result = makeResult({ appliedPayload: undefined });
      expect(() => validator.validateResultOrThrow(result)).toThrow(ValidationFailedException);
    });
  });
});
