import type { KnowledgeUpdateSession } from "../entities/knowledge-update-session.js";
import { DependencyNotSatisfiedException } from "../errors/dependency-not-satisfied-exception.js";
import { PipelineStageFailureException } from "../errors/pipeline-stage-failure-exception.js";
import { KnowledgeAutoUpdateEventType } from "../events/knowledge-auto-update-event-type.js";
import { KnowledgeUpdateSessionFactory } from "../factories/knowledge-update-session-factory.js";
import type { KnowledgeUpdatePipeline } from "../pipeline/knowledge-update-pipeline.js";
import type { PipelineServices } from "../pipeline/pipeline-stage.js";
import type { KnowledgeUpdateRegistry } from "../registry/knowledge-update-registry.js";
import type { KnowledgeUpdateScheduler } from "../scheduler/knowledge-update-scheduler.js";
import { KnowledgeRetryPolicy } from "../strategies/knowledge-retry-policy.js";
import { KnowledgeUpdateJobStatus } from "../types/job-status.js";
import type { KnowledgeUpdatePolicy } from "../value-objects/knowledge-update-policy.js";

import type { KnowledgeUpdateManager } from "./knowledge-update-manager.js";

/**
 * Orchestrates one `processTick(now)` run: pulls due job ids from `KnowledgeUpdateScheduler`
 * (already ordered by dependency + priority), runs `KnowledgeUpdatePipeline` for each in order,
 * and applies the outcome (complete / retry-with-backoff / fail / re-queue-if-dependency-blocked)
 * back onto the job via `KnowledgeUpdateManager`. Everything is driven by the explicit `now`
 * argument — no real timers.
 */
export class KnowledgeUpdateCoordinator {
  private readonly registry: KnowledgeUpdateRegistry;
  private readonly scheduler: KnowledgeUpdateScheduler;
  private readonly manager: KnowledgeUpdateManager;
  private readonly pipeline: KnowledgeUpdatePipeline;
  private readonly services: PipelineServices;
  private readonly retryPolicy: KnowledgeRetryPolicy;
  private readonly sessionFactory: KnowledgeUpdateSessionFactory;

  constructor(
    registry: KnowledgeUpdateRegistry,
    scheduler: KnowledgeUpdateScheduler,
    manager: KnowledgeUpdateManager,
    pipeline: KnowledgeUpdatePipeline,
    services: PipelineServices,
    retryPolicy: KnowledgeRetryPolicy = new KnowledgeRetryPolicy(),
    sessionFactory: KnowledgeUpdateSessionFactory = new KnowledgeUpdateSessionFactory(),
  ) {
    this.registry = registry;
    this.scheduler = scheduler;
    this.manager = manager;
    this.pipeline = pipeline;
    this.services = services;
    this.retryPolicy = retryPolicy;
    this.sessionFactory = sessionFactory;
  }

  processTick(now: number): KnowledgeUpdateSession {
    const dueJobIds = this.scheduler.processDue(now);
    let session = this.sessionFactory.create(now);
    this.registry.putSession(session);

    for (const jobId of dueJobIds) {
      session = this.processOneJob(jobId, session, now);
      this.registry.putSession(session);
    }

    session = session.withCompletedAt(now);
    this.registry.putSession(session);
    return session;
  }

  private countDependents(jobId: string): number {
    return this.registry
      .listJobs()
      .filter(
        (job) =>
          job.dependsOn.includes(jobId) &&
          (job.status === KnowledgeUpdateJobStatus.Pending ||
            job.status === KnowledgeUpdateJobStatus.Scheduled),
      ).length;
  }

  private processOneJob(
    jobId: string,
    session: KnowledgeUpdateSession,
    now: number,
  ): KnowledgeUpdateSession {
    const job = this.manager.getJob(jobId);
    const policy = this.registry.getPolicy(job.policyId);
    this.manager.transitionStatus(jobId, KnowledgeUpdateJobStatus.Running);

    try {
      const context = this.pipeline.run(
        { job, policy, sessionId: session.id, dependentCount: this.countDependents(jobId) },
        this.services,
      );
      let nextSession = session;
      if (context.task) nextSession = nextSession.withTaskId(context.task.id);
      if (context.result) nextSession = nextSession.withResultId(context.result.id);

      if (context.result?.success) {
        this.manager.transitionStatus(
          jobId,
          KnowledgeUpdateJobStatus.Completed,
          "update_succeeded",
        );
      } else {
        this.handleFailure(job.id, policy, now);
      }
      return nextSession;
    } catch (error) {
      if (
        error instanceof PipelineStageFailureException &&
        error.cause instanceof DependencyNotSatisfiedException
      ) {
        this.requeueBlockedJob(jobId, now);
        return session;
      }
      this.handleFailure(jobId, policy, now);
      return session;
    }
  }

  private handleFailure(jobId: string, policy: KnowledgeUpdatePolicy, now: number): void {
    const job = this.manager.getJob(jobId);
    if (this.retryPolicy.shouldRetry(job.attempt, policy.retry)) {
      const delay = this.retryPolicy.nextAttemptDelay(job.attempt, policy.retry);
      const retried = job
        .withAttemptIncremented(now)
        .withStatus(KnowledgeUpdateJobStatus.RetryScheduled, now);
      this.manager.saveJob(retried, "retry_scheduled");
      if (!this.scheduler.isScheduled(jobId)) {
        // One-shot schedules (Immediate/Scheduled) are removed from the scheduler once
        // dispatched — re-register so the retry can still fire, then force the exact
        // retry time below (register()'s own initial-run-at computation ignores backoff).
        this.scheduler.register(jobId, retried.schedule, retried.priority, retried.dependsOn, now);
      }
      this.scheduler.reschedule(jobId, now + delay);
      this.services.statistics.recordRetry();
      this.services.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateRetried, {
        jobId,
        attempt: retried.attempt,
        delayMs: delay,
      });
    } else {
      this.manager.transitionStatus(jobId, KnowledgeUpdateJobStatus.Failed, "retries_exhausted");
    }
  }

  private requeueBlockedJob(jobId: string, now: number): void {
    const job = this.manager.transitionStatus(
      jobId,
      KnowledgeUpdateJobStatus.Pending,
      "blocked_on_dependencies",
    );
    if (this.scheduler.isScheduled(jobId)) {
      this.scheduler.reschedule(jobId, now + 1);
    } else {
      this.scheduler.register(jobId, job.schedule, job.priority, job.dependsOn, now + 1);
    }
  }

  pauseJob(jobId: string): void {
    this.scheduler.pause(jobId);
    this.manager.transitionStatus(jobId, KnowledgeUpdateJobStatus.Paused, "paused");
    this.services.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdatePaused, { jobId });
  }

  resumeJob(jobId: string): void {
    this.scheduler.resume(jobId);
    this.manager.transitionStatus(jobId, KnowledgeUpdateJobStatus.Scheduled, "resumed");
    this.services.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateResumed, { jobId });
  }

  cancelJob(jobId: string): void {
    if (this.scheduler.isScheduled(jobId)) this.scheduler.cancel(jobId);
    this.manager.transitionStatus(jobId, KnowledgeUpdateJobStatus.Cancelled, "cancelled");
    this.services.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateCancelled, { jobId });
  }
}
