import type { CreateJobInput } from "../entities/job.js";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface ValidationContext {
  /** Tenant ids the caller is authorized to create jobs for — undefined means "unscoped/platform caller". */
  readonly allowedTenantIds?: ReadonlySet<string>;
  /** Every job id already known to the Store — consulted by `dependency-validator.ts`. */
  readonly existingJobIds?: ReadonlySet<string>;
  /** `dependsOnJobIds` for every existing job, keyed by jobId — consulted for Cycle Detection. */
  readonly existingDependenciesByJobId?: ReadonlyMap<string, readonly string[]>;
  /** The jobId being validated, if this is an update to an existing job (needed for self-referential Cycle Detection). */
  readonly candidateJobId?: string;
}

/** One stage of the Job Validation pipeline (Schedule/Cron/Timezone/Retry/Dependency/Tenant). */
export interface IJobValidator {
  readonly name: string;
  validate(input: CreateJobInput, context: ValidationContext): ValidationResult;
}
