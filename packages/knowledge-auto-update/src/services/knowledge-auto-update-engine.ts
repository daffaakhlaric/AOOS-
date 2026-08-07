import { KnowledgeUpdateReportBuilder } from "../builders/knowledge-update-report-builder.js";
import type { IClock } from "../contracts/i-clock.js";
import type { IKnowledgeAutoUpdateEventPublisher } from "../contracts/i-knowledge-auto-update-event-publisher.js";
import type { IKnowledgeAutoUpdateModule } from "../contracts/i-knowledge-auto-update-module.js";
import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import { KnowledgeUpdateSnapshot } from "../entities/knowledge-update-snapshot.js";
import { InMemoryEventPublisher } from "../events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEventType } from "../events/knowledge-auto-update-event-type.js";
import type { CreateJobInput } from "../factories/knowledge-update-job-factory.js";
import { KnowledgeUpdateJobFactory } from "../factories/knowledge-update-job-factory.js";
import {
  KnowledgeUpdatePolicyFactory,
  type CreatePolicyInput,
} from "../factories/knowledge-update-policy-factory.js";
import { KnowledgeUpdateResultFactory } from "../factories/knowledge-update-result-factory.js";
import { KnowledgeUpdateTaskFactory } from "../factories/knowledge-update-task-factory.js";
import { KnowledgeUpdatePipeline } from "../pipeline/knowledge-update-pipeline.js";
import type { PipelineServices } from "../pipeline/pipeline-stage.js";
import { KnowledgeUpdateRegistry } from "../registry/knowledge-update-registry.js";
import { KnowledgeUpdateScheduler } from "../scheduler/knowledge-update-scheduler.js";
import { KnowledgeBackoffStrategy } from "../strategies/knowledge-backoff-strategy.js";
import { KnowledgeRetryPolicy } from "../strategies/knowledge-retry-policy.js";
import { KnowledgeUpdateStrategyRegistry } from "../strategies/knowledge-update-strategy-registry.js";
import { KnowledgeUpdateJobStatus } from "../types/job-status.js";
import { SystemClock } from "../utils/clock.js";
import { generateId } from "../utils/id-generator.js";
import { KnowledgeUpdateConfiguration } from "../value-objects/knowledge-update-configuration.js";
import type { KnowledgeUpdatePolicy } from "../value-objects/knowledge-update-policy.js";

import { KnowledgeChangeAnalyzer } from "./knowledge-change-analyzer.js";
import { KnowledgeConflictResolver } from "./knowledge-conflict-resolver.js";
import { KnowledgeDependencyAnalyzer } from "./knowledge-dependency-analyzer.js";
import { KnowledgePriorityCalculator } from "./knowledge-priority-calculator.js";
import { KnowledgeStalenessAnalyzer } from "./knowledge-staleness-analyzer.js";
import { KnowledgeUpdateCoordinator } from "./knowledge-update-coordinator.js";
import { KnowledgeUpdateDetector } from "./knowledge-update-detector.js";
import { KnowledgeUpdateManager } from "./knowledge-update-manager.js";
import {
  KnowledgeUpdateMetrics,
  type KnowledgeUpdateMetricsSnapshot,
} from "./knowledge-update-metrics.js";
import { KnowledgeUpdateStatistics } from "./knowledge-update-statistics.js";
import { KnowledgeUpdateValidator } from "./knowledge-update-validator.js";

const JobStatus = KnowledgeUpdateJobStatus;

export interface KnowledgeAutoUpdateEngineOptions {
  readonly clock?: IClock;
  readonly eventPublisher?: IKnowledgeAutoUpdateEventPublisher;
  readonly config?: KnowledgeUpdateConfiguration;
}

/**
 * Top-level facade composing every service/scheduler/pipeline/registry in this package into one
 * public API. This is the package's single intended integration surface for hosts.
 */
export class KnowledgeAutoUpdateEngine implements IKnowledgeAutoUpdateModule {
  readonly id: string;

  private readonly clock: IClock;
  private readonly eventPublisher: IKnowledgeAutoUpdateEventPublisher;
  private config: KnowledgeUpdateConfiguration;

  private readonly registry = new KnowledgeUpdateRegistry();
  private readonly scheduler = new KnowledgeUpdateScheduler();
  private readonly manager: KnowledgeUpdateManager;
  private readonly coordinator: KnowledgeUpdateCoordinator;
  private readonly statistics = new KnowledgeUpdateStatistics();
  private readonly metrics = new KnowledgeUpdateMetrics();
  private readonly reportBuilder = new KnowledgeUpdateReportBuilder();
  private readonly policyFactory = new KnowledgeUpdatePolicyFactory();
  private readonly jobFactory = new KnowledgeUpdateJobFactory();

  constructor(options: KnowledgeAutoUpdateEngineOptions = {}) {
    this.id = generateId("knowledge-auto-update-engine");
    this.clock = options.clock ?? new SystemClock();
    this.eventPublisher = options.eventPublisher ?? new InMemoryEventPublisher(this.clock);

    const defaultPolicy = this.policyFactory.create({ name: "default" });
    this.registry.putPolicy(defaultPolicy);
    this.config = options.config ?? KnowledgeUpdateConfiguration.default(defaultPolicy.id);

    this.manager = new KnowledgeUpdateManager(this.registry, this.clock, this.jobFactory);

    const services: PipelineServices = {
      clock: this.clock,
      registry: this.registry,
      detector: new KnowledgeUpdateDetector(),
      changeAnalyzer: new KnowledgeChangeAnalyzer(),
      validator: new KnowledgeUpdateValidator(),
      dependencyAnalyzer: new KnowledgeDependencyAnalyzer(),
      conflictResolver: new KnowledgeConflictResolver(),
      stalenessAnalyzer: new KnowledgeStalenessAnalyzer(),
      priorityCalculator: new KnowledgePriorityCalculator(),
      strategyRegistry: new KnowledgeUpdateStrategyRegistry(),
      taskFactory: new KnowledgeUpdateTaskFactory(),
      resultFactory: new KnowledgeUpdateResultFactory(),
      reportBuilder: this.reportBuilder,
      statistics: this.statistics,
      eventPublisher: this.eventPublisher,
    };

    this.coordinator = new KnowledgeUpdateCoordinator(
      this.registry,
      this.scheduler,
      this.manager,
      new KnowledgeUpdatePipeline(),
      services,
      new KnowledgeRetryPolicy(new KnowledgeBackoffStrategy()),
    );
  }

  start(): void {
    // No real resources to acquire — everything is in-memory and constructed eagerly.
  }

  stop(): void {
    // No real resources to release.
  }

  registerPolicy(input: CreatePolicyInput): KnowledgeUpdatePolicy {
    const policy = this.policyFactory.create(input);
    this.registry.putPolicy(policy);
    return policy;
  }

  getPolicy(id: string): KnowledgeUpdatePolicy {
    return this.registry.getPolicy(id);
  }

  get defaultPolicyId(): string {
    return this.config.defaultPolicyId;
  }

  scheduleJob(
    input: Omit<CreateJobInput, "policyId"> & { readonly policyId?: string },
  ): KnowledgeUpdateJob {
    const now = this.clock.now();
    let job = this.manager.createJob({
      ...input,
      policyId: input.policyId ?? this.config.defaultPolicyId,
    });
    this.scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, now);
    job = this.manager.transitionStatus(job.id, JobStatus.Scheduled, "scheduled");
    this.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateScheduled, {
      jobId: job.id,
      updateType: job.updateType,
    });
    return job;
  }

  pauseJob(jobId: string): void {
    this.coordinator.pauseJob(jobId);
  }

  resumeJob(jobId: string): void {
    this.coordinator.resumeJob(jobId);
  }

  cancelJob(jobId: string): void {
    this.coordinator.cancelJob(jobId);
  }

  tick(now: number = this.clock.now()) {
    return this.coordinator.processTick(now);
  }

  getJob(jobId: string): KnowledgeUpdateJob {
    return this.manager.getJob(jobId);
  }

  listJobs(): readonly KnowledgeUpdateJob[] {
    return this.manager.listJobs();
  }

  listJobsByStatus(status: KnowledgeUpdateJobStatus): readonly KnowledgeUpdateJob[] {
    return this.manager.listJobsByStatus(status);
  }

  getMetrics(): KnowledgeUpdateMetricsSnapshot {
    const jobs = this.manager.listJobs();
    const counts = this.statistics.snapshot();
    return this.metrics.compute({
      ...counts,
      pendingJobs: jobs.filter(
        (j) => j.status === JobStatus.Pending || j.status === JobStatus.Scheduled,
      ).length,
      completedJobs: jobs.filter((j) => j.status === JobStatus.Completed).length,
      cancelledJobs: jobs.filter((j) => j.status === JobStatus.Cancelled).length,
      expiredJobs: jobs.filter((j) => j.status === JobStatus.Expired).length,
      queueSize: this.scheduler.size,
    });
  }

  getSnapshot(): KnowledgeUpdateSnapshot {
    const jobs = this.manager.listJobs();
    return new KnowledgeUpdateSnapshot({
      id: generateId("snapshot"),
      takenAt: this.clock.now(),
      pendingJobCount: jobs.filter(
        (j) => j.status === JobStatus.Pending || j.status === JobStatus.Scheduled,
      ).length,
      completedJobCount: jobs.filter((j) => j.status === JobStatus.Completed).length,
      cancelledJobCount: jobs.filter((j) => j.status === JobStatus.Cancelled).length,
      expiredJobCount: jobs.filter((j) => j.status === JobStatus.Expired).length,
      queueSize: this.scheduler.size,
    });
  }

  expireStaleJobs(now: number = this.clock.now()): readonly KnowledgeUpdateJob[] {
    const expired: KnowledgeUpdateJob[] = [];
    for (const job of this.manager.listJobs()) {
      if (job.status !== JobStatus.Pending && job.status !== JobStatus.Scheduled) continue;
      const policy = this.registry.getPolicy(job.policyId);
      if (now - job.createdAt > policy.expiration.expireAfterMs) {
        const updated = this.manager.transitionStatus(job.id, JobStatus.Expired, "expired");
        if (this.scheduler.isScheduled(job.id)) this.scheduler.cancel(job.id);
        expired.push(updated);
      }
    }
    return expired;
  }
}
