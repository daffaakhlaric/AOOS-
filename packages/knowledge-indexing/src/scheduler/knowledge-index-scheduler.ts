import { IndexScheduleException } from "../errors/index-schedule-exception.js";
import { generateId } from "../utils/id.js";

import { KnowledgeIndexScheduleJobType } from "./knowledge-index-schedule-job-type.js";
import type { KnowledgeIndexScheduleJob } from "./knowledge-index-schedule-job.js";

export interface ScheduleJobInput {
  readonly assetId?: string;
}

/**
 * "SCHEDULER: Support Reindex, Incremental, Full, Version Update, Policy Update,
 * Relationship Update." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — an in-memory job
 * ledger tracking which reindex work has been requested and its outcome; this package
 * never performs the actual reindex work itself (that is `KnowledgeIndexPipeline`'s job,
 * invoked by whichever caller reacts to a scheduled job).
 */
export class KnowledgeIndexScheduler {
  private readonly jobs = new Map<string, KnowledgeIndexScheduleJob>();

  schedule(
    type: KnowledgeIndexScheduleJobType,
    input: ScheduleJobInput = {},
  ): KnowledgeIndexScheduleJob {
    const job: KnowledgeIndexScheduleJob = {
      id: generateId(),
      type,
      assetId: input.assetId,
      status: "pending",
      scheduledAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  reindex(assetId: string): KnowledgeIndexScheduleJob {
    return this.schedule(KnowledgeIndexScheduleJobType.REINDEX, { assetId });
  }

  incremental(assetId: string): KnowledgeIndexScheduleJob {
    return this.schedule(KnowledgeIndexScheduleJobType.INCREMENTAL, { assetId });
  }

  full(): KnowledgeIndexScheduleJob {
    return this.schedule(KnowledgeIndexScheduleJobType.FULL);
  }

  onVersionUpdate(assetId: string): KnowledgeIndexScheduleJob {
    return this.schedule(KnowledgeIndexScheduleJobType.VERSION_UPDATE, { assetId });
  }

  onPolicyUpdate(assetId: string): KnowledgeIndexScheduleJob {
    return this.schedule(KnowledgeIndexScheduleJobType.POLICY_UPDATE, { assetId });
  }

  onRelationshipUpdate(assetId: string): KnowledgeIndexScheduleJob {
    return this.schedule(KnowledgeIndexScheduleJobType.RELATIONSHIP_UPDATE, { assetId });
  }

  start(jobId: string): KnowledgeIndexScheduleJob {
    const job = this.require(jobId);
    return this.write({ ...job, status: "running", startedAt: new Date().toISOString() });
  }

  complete(jobId: string): KnowledgeIndexScheduleJob {
    const job = this.require(jobId);
    return this.write({ ...job, status: "completed", completedAt: new Date().toISOString() });
  }

  fail(jobId: string, reason?: string): KnowledgeIndexScheduleJob {
    const job = this.require(jobId);
    return this.write({ ...job, status: "failed", completedAt: new Date().toISOString(), reason });
  }

  cancel(jobId: string): KnowledgeIndexScheduleJob {
    const job = this.require(jobId);
    if (job.status !== "pending") {
      throw new IndexScheduleException(
        `Job "${jobId}" is "${job.status}" — only a pending job can be cancelled`,
      );
    }
    return this.write({ ...job, status: "cancelled", completedAt: new Date().toISOString() });
  }

  get(jobId: string): KnowledgeIndexScheduleJob | undefined {
    return this.jobs.get(jobId);
  }

  require(jobId: string): KnowledgeIndexScheduleJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new IndexScheduleException(`No scheduled job found with id "${jobId}"`);
    }
    return job;
  }

  list(status?: KnowledgeIndexScheduleJob["status"]): readonly KnowledgeIndexScheduleJob[] {
    const all = Array.from(this.jobs.values());
    return status === undefined ? all : all.filter((job) => job.status === status);
  }

  private write(job: KnowledgeIndexScheduleJob): KnowledgeIndexScheduleJob {
    this.jobs.set(job.id, job);
    return job;
  }
}
