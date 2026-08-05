import type { ExecutionWindow } from "../contracts/execution-window.js";
import type { JobPriority } from "../contracts/job-priority.js";
import type { JobState } from "../contracts/job-state.js";
import type { RetryPolicyConfig } from "../contracts/retry-policy-config.js";
import type { RetryMetadata } from "../contracts/retry-policy.js";
import type { Schedule } from "../contracts/schedule.js";
import type { TriggerType } from "../contracts/trigger-type.js";

/**
 * The stored Job entity — the envelope wrapping a Schedule with its runtime state, mirroring
 * `@aos/registry`'s `RegistryEntry<TManifest>` pattern (a manifest/config plus the
 * envelope fields the engine itself owns: state, timestamps, changelog).
 */
export interface JobRecord {
  readonly jobId: string;
  /** Absent for platform-wide jobs not scoped to a single tenant. */
  readonly tenantId?: string;
  readonly name: string;
  readonly schedule: Schedule;
  readonly priority: JobPriority;
  readonly state: JobState;
  readonly triggerType: TriggerType;
  readonly payload?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly executionWindow?: ExecutionWindow;
  readonly retryPolicyConfig?: RetryPolicyConfig;
  readonly retryMetadata?: RetryMetadata;
  /** Computed by planner/schedule-planner.ts — when this Job is next due, if ever. */
  readonly nextFireAt?: string;
  readonly lastFireAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** One entry per state transition, in order — the audit trail `scheduler.job.*` events are derived from. */
  readonly changelog: readonly JobState[];
}

/** The caller-supplied fields needed to create a Job — everything else (`jobId`, timestamps, `state`, `changelog`) is generated. */
export interface CreateJobInput {
  readonly tenantId?: string;
  readonly name: string;
  readonly schedule: Schedule;
  readonly priority?: JobPriority;
  readonly payload?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly executionWindow?: ExecutionWindow;
  readonly retryPolicyConfig?: RetryPolicyConfig;
}
