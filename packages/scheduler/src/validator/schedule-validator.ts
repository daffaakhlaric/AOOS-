import { scheduleSchema } from "../contracts/schedule.js";
import type { CreateJobInput } from "../entities/job.js";

import type { IJobValidator, ValidationContext, ValidationResult } from "./i-job-validator.js";

/** Schedule Validation — the `schedule` field must satisfy one of the 8 Supported Schedule kinds. */
export class ScheduleValidator implements IJobValidator {
  readonly name = "schedule";

  validate(input: CreateJobInput, _context: ValidationContext): ValidationResult {
    const result = scheduleSchema.safeParse(input.schedule);
    if (result.success) {
      return { valid: true, issues: [] };
    }
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        path: `schedule.${issue.path.join(".")}`,
        message: issue.message,
      })),
    };
  }
}
