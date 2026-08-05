import type { CreateJobInput } from "../entities/job.js";

import { CronValidator } from "./cron-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import type { IJobValidator, ValidationContext, ValidationResult } from "./i-job-validator.js";
import { RetryValidator } from "./retry-validator.js";
import { ScheduleValidator } from "./schedule-validator.js";
import { TenantValidator } from "./tenant-validator.js";
import { TimezoneValidator } from "./timezone-validator.js";

/**
 * Runs Schedule → Cron → Timezone → Retry → Dependency → Tenant in order, aggregating
 * every issue (does not short-circuit on the first failure).
 */
export class ValidationPipeline {
  private readonly validators: readonly IJobValidator[];

  constructor(extraValidators: readonly IJobValidator[] = []) {
    this.validators = [
      new ScheduleValidator(),
      new CronValidator(),
      new TimezoneValidator(),
      new RetryValidator(),
      new DependencyValidator(),
      new TenantValidator(),
      ...extraValidators,
    ];
  }

  run(input: CreateJobInput, context: ValidationContext): ValidationResult {
    const issues: ValidationResult["issues"][number][] = [];
    for (const validator of this.validators) {
      const result = validator.validate(input, context);
      issues.push(...result.issues);
    }
    return { valid: issues.length === 0, issues };
  }
}
