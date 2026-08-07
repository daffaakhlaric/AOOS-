import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import type { KnowledgeUpdateResult } from "../entities/knowledge-update-result.js";
import type { InvalidCronExpressionException } from "../errors/invalid-cron-expression-exception.js";
import { ValidationFailedException } from "../errors/validation-failed-exception.js";
import { ScheduleKind } from "../types/schedule-descriptor.js";
import { parseCronExpression } from "../utils/cron.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Validates a job's structural well-formedness and a completed update result's correctness. */
export class KnowledgeUpdateValidator {
  validateJob(job: KnowledgeUpdateJob): ValidationResult {
    const errors: string[] = [];

    if (job.targetId.trim().length === 0) errors.push("targetId must not be empty");
    if (job.policyId.trim().length === 0) errors.push("policyId must not be empty");
    if (job.dependsOn.includes(job.id)) errors.push("job cannot depend on itself");
    if (new Set(job.dependsOn).size !== job.dependsOn.length) {
      errors.push("dependsOn must not contain duplicates");
    }

    if (job.schedule.kind === ScheduleKind.Interval && job.schedule.intervalMs <= 0) {
      errors.push("interval schedule intervalMs must be > 0");
    }
    if (job.schedule.kind === ScheduleKind.Cron) {
      try {
        parseCronExpression(job.schedule.expression);
      } catch (error) {
        // parseCronExpression always throws InvalidCronExpressionException (see utils/cron.ts).
        errors.push((error as InvalidCronExpressionException).message);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateJobOrThrow(job: KnowledgeUpdateJob): void {
    const result = this.validateJob(job);
    if (!result.valid) throw new ValidationFailedException(`job ${job.id}`, result.errors);
  }

  validateResult(result: KnowledgeUpdateResult): ValidationResult {
    const errors: string[] = [];
    if (result.durationMs < 0) errors.push("durationMs must be >= 0");
    if (result.success && result.appliedPayload === undefined) {
      errors.push("successful result must include appliedPayload");
    }
    if (!result.success && result.errorMessage === undefined) {
      errors.push("failed result must include errorMessage");
    }
    return { valid: errors.length === 0, errors };
  }

  validateResultOrThrow(result: KnowledgeUpdateResult): void {
    const validation = this.validateResult(result);
    if (!validation.valid) {
      throw new ValidationFailedException(`result ${result.id}`, validation.errors);
    }
  }
}
