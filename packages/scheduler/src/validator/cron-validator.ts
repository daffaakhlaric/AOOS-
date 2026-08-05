import { ScheduleType } from "../contracts/schedule-type.js";
import type { CreateJobInput } from "../entities/job.js";
import { CronParseException } from "../errors/cron-parse-exception.js";
import { parseCronExpression } from "../planner/cron-parser.js";

import type { IJobValidator, ValidationContext, ValidationResult } from "./i-job-validator.js";

/** Cron Validation — a `ScheduleType.CRON` job's `expression` must be a parseable 5-field Cron Expression. */
export class CronValidator implements IJobValidator {
  readonly name = "cron";

  validate(input: CreateJobInput, _context: ValidationContext): ValidationResult {
    if (input.schedule.type !== ScheduleType.CRON) {
      return { valid: true, issues: [] };
    }
    try {
      parseCronExpression(input.schedule.expression);
      return { valid: true, issues: [] };
    } catch (error) {
      const message = error instanceof CronParseException ? error.message : String(error);
      return { valid: false, issues: [{ path: "schedule.expression", message }] };
    }
  }
}
