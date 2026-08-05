import type { CreateJobInput } from "../entities/job.js";

import type { IJobValidator, ValidationContext, ValidationResult } from "./i-job-validator.js";

/** Retry Validation — `retryPolicyConfig`, if set, must have a sane `baseDelayMs <= maxDelayMs`. */
export class RetryValidator implements IJobValidator {
  readonly name = "retry";

  validate(input: CreateJobInput, _context: ValidationContext): ValidationResult {
    const config = input.retryPolicyConfig;
    if (!config) {
      return { valid: true, issues: [] };
    }
    if (config.baseDelayMs > config.maxDelayMs) {
      return {
        valid: false,
        issues: [
          {
            path: "retryPolicyConfig.baseDelayMs",
            message: `baseDelayMs (${config.baseDelayMs}) must not exceed maxDelayMs (${config.maxDelayMs})`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
