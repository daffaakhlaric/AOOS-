import type { IClockProvider } from "../clock/i-clock-provider.js";
import { SystemClock } from "../clock/system-clock.js";
import { JobPriority } from "../contracts/job-priority.js";
import { JOB_STATE_TRANSITIONS, JobState } from "../contracts/job-state.js";
import { ScheduleType } from "../contracts/schedule-type.js";
import { TriggerType } from "../contracts/trigger-type.js";
import type { DispatchDecision } from "../dispatcher/i-dispatcher.js";
import { JobDispatcher } from "../dispatcher/job-dispatcher.js";
import type { CreateJobInput, JobRecord } from "../entities/job.js";
import { RetryExhaustedException } from "../errors/retry-exhausted-exception.js";
import { SchedulerException } from "../errors/scheduler-exception.js";
import { StateTransitionException } from "../errors/state-transition-exception.js";
import { ValidationException } from "../errors/validation-exception.js";
import type { SchedulerEventPublisher } from "../events/scheduler-event-publisher.js";
import { SchedulerJobEventType } from "../events/scheduler-job-event-type.js";
import type { ISchedulerLockProvider } from "../lock/i-scheduler-lock-provider.js";
import { InMemoryLockProvider } from "../lock/in-memory-lock-provider.js";
import { SchedulerMetricsCollector } from "../metrics/scheduler-metrics-collector.js";
import { SchedulePlanner } from "../planner/schedule-planner.js";
import type { ISchedulerPolicy } from "../policy/i-scheduler-policy.js";
import { PolicyPipeline } from "../policy/policy-pipeline.js";
import { createRetryPolicy } from "../retry/retry-policy-factory.js";
import type { IScheduleStore } from "../store-interface/i-schedule-store.js";
import { InMemoryScheduleStore } from "../store-interface/in-memory-schedule-store.js";
import { TimerService } from "../timer/timer-service.js";
import { DependencyTrigger } from "../trigger/dependency-trigger.js";
import { ManualTrigger } from "../trigger/manual-trigger.js";
import { RetryTrigger } from "../trigger/retry-trigger.js";
import { generateId } from "../utils/id.js";
import type { ValidationContext } from "../validator/i-job-validator.js";
import { ValidationPipeline } from "../validator/validation-pipeline.js";

export interface SchedulerOptions {
  readonly eventPublisher: SchedulerEventPublisher;
  readonly store?: IScheduleStore;
  readonly clock?: IClockProvider;
  readonly lockProvider?: ISchedulerLockProvider;
  readonly policies?: readonly ISchedulerPolicy[];
  readonly validationContext?: Omit<
    ValidationContext,
    "existingJobIds" | "existingDependenciesByJobId" | "candidateJobId"
  >;
  readonly lockTtlMs?: number;
}

function resolveTriggerType(scheduleType: ScheduleType): TriggerType {
  if (scheduleType === ScheduleType.MANUAL) {
    return TriggerType.MANUAL;
  }
  if (scheduleType === ScheduleType.DEPENDENCY) {
    return TriggerType.DEPENDENCY;
  }
  return TriggerType.TIME;
}

/**
 * The Scheduler itself — the composition root, mirroring `EventBroker` (`@aos/event-bus`)
 * and `RegistrySystem` (`@aos/registry`). "Scheduler bertanggung jawab menentukan KAPAN
 * sebuah Job dijalankan... Scheduler hanya menerbitkan Event": every state-changing method
 * here ends by publishing the matching `scheduler.job.*` event, and nothing in this class
 * ever calls a Workflow/Agent/Tool directly.
 */
export class Scheduler {
  readonly metrics = new SchedulerMetricsCollector();

  private readonly store: IScheduleStore;
  private readonly clock: IClockProvider;
  private readonly planner = new SchedulePlanner();
  private readonly manualTrigger: ManualTrigger;
  private readonly dependencyTrigger: DependencyTrigger;
  private readonly retryTrigger: RetryTrigger;
  private readonly eventPublisher: SchedulerEventPublisher;
  private readonly validationPipeline = new ValidationPipeline();
  private readonly validationContext: Omit<
    ValidationContext,
    "existingJobIds" | "existingDependenciesByJobId" | "candidateJobId"
  >;
  readonly lockProvider: ISchedulerLockProvider;
  readonly policyPipeline: PolicyPipeline;
  private readonly timer: TimerService;
  private readonly dispatcher: JobDispatcher;

  constructor(options: SchedulerOptions) {
    this.store = options.store ?? new InMemoryScheduleStore();
    this.clock = options.clock ?? new SystemClock();
    this.eventPublisher = options.eventPublisher;
    this.lockProvider = options.lockProvider ?? new InMemoryLockProvider(this.clock);
    this.policyPipeline = new PolicyPipeline(options.policies ?? []);
    this.manualTrigger = new ManualTrigger(this.store, this.clock);
    this.dependencyTrigger = new DependencyTrigger(this.store, this.clock);
    this.retryTrigger = new RetryTrigger(this.store, this.clock);
    this.timer = new TimerService(this.clock, this.store);
    this.dispatcher = new JobDispatcher({
      store: this.store,
      policyPipeline: this.policyPipeline,
      lockProvider: this.lockProvider,
      clock: this.clock,
      lockTtlMs: options.lockTtlMs,
    });
    this.validationContext = options.validationContext ?? {};
  }

  /** Gates a Ready Job's hand-off through the Policy Pipeline + Distributed Lock — see `dispatcher/job-dispatcher.ts`. */
  async dispatchReady(jobId: string): Promise<DispatchDecision> {
    return this.dispatcher.dispatch(jobId);
  }

  get scheduleStore(): IScheduleStore {
    return this.store;
  }

  get scheduleClock(): IClockProvider {
    return this.clock;
  }

  async createJob(input: CreateJobInput): Promise<JobRecord> {
    const existing = await this.store.list();
    const context: ValidationContext = {
      ...this.validationContext,
      existingJobIds: new Set(existing.map((job) => job.jobId)),
      existingDependenciesByJobId: new Map(
        existing
          .filter((job) => job.schedule.type === ScheduleType.DEPENDENCY)
          .map((job) => [
            job.jobId,
            (job.schedule as { dependsOnJobIds: readonly string[] }).dependsOnJobIds,
          ]),
      ),
    };
    const result = this.validationPipeline.run(input, context);
    if (!result.valid) {
      const reason = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
      throw new ValidationException(`Job "${input.name}" failed validation: ${reason}`);
    }

    const now = this.clock.now();
    const nextFireAt = this.planner.computeNextFireTime(input.schedule, {
      after: now,
      createdAt: now,
    });

    const job: JobRecord = {
      jobId: generateId(),
      tenantId: input.tenantId,
      name: input.name,
      schedule: input.schedule,
      priority: input.priority ?? JobPriority.NORMAL,
      state: JobState.WAITING,
      triggerType: resolveTriggerType(input.schedule.type),
      payload: input.payload,
      metadata: input.metadata,
      executionWindow: input.executionWindow,
      retryPolicyConfig: input.retryPolicyConfig,
      nextFireAt: nextFireAt?.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      changelog: [JobState.PENDING, JobState.WAITING],
    };

    const created = await this.store.create(job);
    this.metrics.recordJobCreated();
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.CREATED, created);
    return created;
  }

  async deleteJob(jobId: string): Promise<void> {
    const job = await this.requireJob(jobId);
    await this.store.delete(jobId);
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.DELETED, job);
  }

  async pauseJob(jobId: string): Promise<JobRecord> {
    const paused = await this.transition(jobId, JobState.PAUSED);
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.PAUSED, paused);
    return paused;
  }

  async resumeJob(jobId: string): Promise<JobRecord> {
    const resumed = await this.transition(jobId, JobState.WAITING);
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.RESUMED, resumed);
    return resumed;
  }

  async cancelJob(jobId: string): Promise<JobRecord> {
    const cancelled = await this.transition(jobId, JobState.CANCELLED);
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.CANCELLED, cancelled);
    return cancelled;
  }

  /** Manual Trigger — the only way a `ScheduleType.MANUAL` Job becomes Ready. */
  async fireManual(jobId: string): Promise<JobRecord> {
    const readied = await this.manualTrigger.fire(jobId);
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.READY, readied);
    return readied;
  }

  /** Advances the Timer one tick, publishing `scheduler.job.ready` for every Job it promotes. */
  async tick(): Promise<readonly string[]> {
    const tickStart = this.clock.now();
    const { readyJobIds } = await this.timer.tick();
    for (const jobId of readyJobIds) {
      const job = await this.store.get(jobId);
      if (job) {
        await this.eventPublisher.publishJobEvent(SchedulerJobEventType.READY, job);
      }
    }
    this.metrics.recordSchedulerLatency(this.clock.now().getTime() - tickStart.getTime());
    return readyJobIds;
  }

  /** Reported by whatever Runtime actually executes the Job (out of scope here) once it picks a Ready Job up. */
  async reportStarted(jobId: string): Promise<JobRecord> {
    const job = await this.requireJob(jobId);
    if (job.nextFireAt) {
      this.metrics.recordExecutionDelay(
        this.clock.now().getTime() - new Date(job.nextFireAt).getTime(),
      );
    }
    const started = await this.transition(jobId, JobState.RUNNING);
    this.metrics.recordJobRunning();
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.STARTED, started);
    return started;
  }

  async reportCompleted(jobId: string): Promise<JobRecord> {
    const completed = await this.transition(jobId, JobState.COMPLETED);
    this.metrics.recordJobSucceeded();
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.COMPLETED, completed);

    const readied = await this.dependencyTrigger.onJobCompleted(jobId);
    for (const dependent of readied) {
      await this.eventPublisher.publishJobEvent(SchedulerJobEventType.READY, dependent);
    }
    return completed;
  }

  async reportFailed(jobId: string, error: string): Promise<JobRecord> {
    const job = await this.requireJob(jobId);
    const failed = await this.transition(jobId, JobState.FAILED);
    this.metrics.recordJobFailed();
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.FAILED, failed, { error });

    if (!job.retryPolicyConfig) {
      return this.expireJob(failed);
    }
    try {
      const retried = await this.retryTrigger.scheduleRetry(
        jobId,
        createRetryPolicy(job.retryPolicyConfig),
        error,
      );
      this.metrics.recordRetry();
      await this.eventPublisher.publishJobEvent(SchedulerJobEventType.RETRY, retried, { error });
      return retried;
    } catch (retryError) {
      if (retryError instanceof RetryExhaustedException) {
        return this.expireJob(failed);
      }
      throw retryError;
    }
  }

  private async expireJob(job: JobRecord): Promise<JobRecord> {
    const expired = await this.transitionFrom(job, JobState.EXPIRED);
    await this.eventPublisher.publishJobEvent(SchedulerJobEventType.EXPIRED, expired);
    return expired;
  }

  private async requireJob(jobId: string): Promise<JobRecord> {
    const job = await this.store.get(jobId);
    if (!job) {
      throw new SchedulerException(`Job "${jobId}" not found`);
    }
    return job;
  }

  private async transition(jobId: string, target: JobState): Promise<JobRecord> {
    return this.transitionFrom(await this.requireJob(jobId), target);
  }

  private async transitionFrom(job: JobRecord, target: JobState): Promise<JobRecord> {
    if (!JOB_STATE_TRANSITIONS[job.state].includes(target)) {
      throw new StateTransitionException(
        `Cannot transition job "${job.jobId}" from "${job.state}" to "${target}"`,
      );
    }
    const now = this.clock.now();
    return this.store.update(job.jobId, {
      state: target,
      updatedAt: now.toISOString(),
      changelog: [...job.changelog, target],
    });
  }
}
