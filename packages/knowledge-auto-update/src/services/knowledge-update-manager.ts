import type { IClock } from "../contracts/i-clock.js";
import { KnowledgeUpdateHistory } from "../entities/knowledge-update-history.js";
import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import type { CreateJobInput } from "../factories/knowledge-update-job-factory.js";
import { KnowledgeUpdateJobFactory } from "../factories/knowledge-update-job-factory.js";
import type { KnowledgeUpdateRegistry } from "../registry/knowledge-update-registry.js";
import type { KnowledgeUpdateJobStatus } from "../types/job-status.js";

/**
 * Job/task/session lifecycle CRUD, backed entirely by `KnowledgeUpdateRegistry` (id-keyed, never
 * scanning for single-entity lookups — `listJobsByStatus` legitimately iterates because it is an
 * aggregate query, not a lookup).
 */
export class KnowledgeUpdateManager {
  private readonly registry: KnowledgeUpdateRegistry;
  private readonly jobFactory: KnowledgeUpdateJobFactory;
  private readonly clock: IClock;

  constructor(
    registry: KnowledgeUpdateRegistry,
    clock: IClock,
    jobFactory = new KnowledgeUpdateJobFactory(),
  ) {
    this.registry = registry;
    this.clock = clock;
    this.jobFactory = jobFactory;
  }

  createJob(input: CreateJobInput): KnowledgeUpdateJob {
    const now = this.clock.now();
    const job = this.jobFactory.create(input, now);
    this.registry.putJob(job);
    this.registry.putHistory(
      KnowledgeUpdateHistory.empty(job.id).withEntry({
        status: job.status,
        at: now,
        reason: "created",
      }),
    );
    return job;
  }

  getJob(id: string): KnowledgeUpdateJob {
    return this.registry.getJob(id);
  }

  findJob(id: string): KnowledgeUpdateJob | undefined {
    return this.registry.findJob(id);
  }

  listJobs(): readonly KnowledgeUpdateJob[] {
    return this.registry.listJobs();
  }

  listJobsByStatus(status: KnowledgeUpdateJobStatus): readonly KnowledgeUpdateJob[] {
    return this.registry.listJobs().filter((job) => job.status === status);
  }

  saveJob(job: KnowledgeUpdateJob, reason?: string): KnowledgeUpdateJob {
    this.registry.putJob(job);
    const history = this.registry.getHistory(job.id) ?? KnowledgeUpdateHistory.empty(job.id);
    this.registry.putHistory(
      history.withEntry({ status: job.status, at: this.clock.now(), reason }),
    );
    return job;
  }

  transitionStatus(
    id: string,
    status: KnowledgeUpdateJobStatus,
    reason?: string,
  ): KnowledgeUpdateJob {
    const job = this.registry.getJob(id).withStatus(status, this.clock.now());
    return this.saveJob(job, reason);
  }

  getHistory(id: string): KnowledgeUpdateHistory {
    return this.registry.getHistory(id) ?? KnowledgeUpdateHistory.empty(id);
  }

  removeJob(id: string): void {
    this.registry.removeJob(id);
  }
}
