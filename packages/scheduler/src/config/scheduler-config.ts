import type { IClockProvider } from "../clock/i-clock-provider.js";
import type { ISchedulerLockProvider } from "../lock/i-scheduler-lock-provider.js";
import type { ISchedulerPolicy } from "../policy/i-scheduler-policy.js";
import type { IScheduleStore } from "../store-interface/i-schedule-store.js";

export interface SchedulerConfig {
  readonly store?: IScheduleStore;
  readonly clock?: IClockProvider;
  readonly lockProvider?: ISchedulerLockProvider;
  readonly policies?: readonly ISchedulerPolicy[];
  readonly allowedTenantIds?: readonly string[];
  readonly lockTtlMs?: number;
}
