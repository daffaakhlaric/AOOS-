import type { IClockProvider } from "../clock/i-clock-provider.js";
import { SchedulerException } from "../errors/scheduler-exception.js";
import type { ISchedulerLockProvider } from "../lock/i-scheduler-lock-provider.js";
import type { PolicyPipeline } from "../policy/policy-pipeline.js";
import type { IScheduleStore } from "../store-interface/i-schedule-store.js";

import type { DispatchDecision, IDispatcher } from "./i-dispatcher.js";

export interface JobDispatcherOptions {
  readonly store: IScheduleStore;
  readonly policyPipeline: PolicyPipeline;
  readonly lockProvider: ISchedulerLockProvider;
  readonly clock: IClockProvider;
  readonly lockTtlMs?: number;
}

/**
 * Job Dispatcher (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "DISPATCHER"): gates a Ready
 * Job's hand-off through the Policy Pipeline (business hours/holiday/tenant quotas — addendum
 * 1) and a Distributed Lock (addendum 2), so at most one Scheduler node ever claims the same
 * Job. It does NOT execute the Job — Scheduler "hanya menerbitkan Event"; a dispatched
 * decision is what `scheduler/scheduler.ts` uses to publish `scheduler.job.ready`.
 */
export class JobDispatcher implements IDispatcher {
  private readonly store: IScheduleStore;
  private readonly policyPipeline: PolicyPipeline;
  private readonly lockProvider: ISchedulerLockProvider;
  private readonly clock: IClockProvider;
  private readonly lockTtlMs: number;

  constructor(options: JobDispatcherOptions) {
    this.store = options.store;
    this.policyPipeline = options.policyPipeline;
    this.lockProvider = options.lockProvider;
    this.clock = options.clock;
    this.lockTtlMs = options.lockTtlMs ?? 30_000;
  }

  async dispatch(jobId: string): Promise<DispatchDecision> {
    const job = await this.store.get(jobId);
    if (!job) {
      throw new SchedulerException(`Cannot dispatch "${jobId}": not found`);
    }

    const policyDecision = await this.policyPipeline.evaluate({
      jobId,
      tenantId: job.tenantId,
      priority: job.priority,
      now: this.clock.now(),
    });
    if (!policyDecision.allowed) {
      return { jobId, dispatched: false, reason: policyDecision.reason };
    }

    const lock = await this.lockProvider.acquire(`scheduler:job:${jobId}`, this.lockTtlMs);
    if (!lock) {
      return { jobId, dispatched: false, reason: "locked by another dispatcher" };
    }

    return { jobId, dispatched: true };
  }
}
