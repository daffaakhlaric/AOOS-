import type { CreateJobInput } from "../entities/job.js";

import type { IJobValidator, ValidationContext, ValidationResult } from "./i-job-validator.js";

/** Timezone Validation — `schedule.timezone` must be a valid IANA timezone name (DST-ready by construction: `Intl` already accounts for it). */
export class TimezoneValidator implements IJobValidator {
  readonly name = "timezone";

  validate(input: CreateJobInput, _context: ValidationContext): ValidationResult {
    const timezone = input.schedule.timezone;
    try {
      // eslint-disable-next-line no-new -- constructing is the validation; the instance itself is unused.
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return { valid: true, issues: [] };
    } catch {
      return {
        valid: false,
        issues: [
          { path: "schedule.timezone", message: `"${timezone}" is not a valid IANA timezone` },
        ],
      };
    }
  }
}
