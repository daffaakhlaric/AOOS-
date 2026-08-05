import type { JobPriority } from "../contracts/job-priority.js";

export interface PolicyContext {
  readonly jobId: string;
  readonly tenantId?: string;
  readonly priority: JobPriority;
  readonly now: Date;
}

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Scheduler Policy Engine port (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md addendum 1).
 * `BusinessHoursPolicy` and `HolidayPolicy` are the two concrete policies shipped in this
 * package; Maximum-concurrent-jobs-per-tenant, Blackout windows, Rate limiting, and Daily
 * execution quota are named as future policies implementing this same interface — "Sekarang
 * cukup interface dan pipeline kebijakannya, implementasi aturan bisa menyusul."
 */
export interface ISchedulerPolicy {
  readonly name: string;
  evaluate(context: PolicyContext): PolicyDecision | Promise<PolicyDecision>;
}
