import type { KnowledgeQualityAssessmentJob } from "../domain/knowledge-quality-assessment-job.js";
import type { KnowledgeQualityExecution } from "../domain/knowledge-quality-execution.js";
import { QualityNotFoundException } from "../errors/quality-not-found-exception.js";
import { KnowledgeQualityRegistryBucket } from "../registry/knowledge-quality-registry-bucket.js";
import type { KnowledgeQualityRegistryEntry } from "../registry/knowledge-quality-registry-entry.js";
import type { KnowledgeQualityRegistry } from "../registry/knowledge-quality-registry.js";
import type { KnowledgeQualitySession } from "../session/knowledge-quality-session.js";
import { KnowledgeQualityStatistics } from "../statistics/knowledge-quality-statistics.js";

/**
 * "KnowledgeQualityManager" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — mid-level orchestrator composing Registry + Session + Statistics +
 * executionsByToken (token-keyed ledger; Map lookups only, never array-scan). Also owns
 * the Job ledger — Jobs are NOT a Registry bucket (the spec's 8 buckets do not include
 * JOB), so `KnowledgeQualityAssessmentJob` records live in a dedicated
 * `jobsById` Map here instead, matching the Session-ledger convention. See
 * docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md — "Registry".
 */
export class KnowledgeQualityManager {
  private readonly executionsByToken = new Map<string, KnowledgeQualityExecution>();
  private readonly jobsById = new Map<string, KnowledgeQualityAssessmentJob>();
  readonly statistics = new KnowledgeQualityStatistics();

  constructor(
    readonly registry: KnowledgeQualityRegistry,
    readonly session: KnowledgeQualitySession,
  ) {}

  register(
    token: string,
    execution: KnowledgeQualityExecution,
    entry: KnowledgeQualityRegistryEntry,
  ): void {
    this.registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, entry);
    this.executionsByToken.set(token, execution);
    this.statistics.recordRequested(execution.request.mode);
  }

  get(token: string): KnowledgeQualityExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeQualityExecution {
    const execution = this.get(token);
    if (!execution) {
      throw new QualityNotFoundException(`No execution registered for token "${token}"`);
    }
    return execution;
  }

  update(token: string, execution: KnowledgeQualityExecution): void {
    if (!this.executionsByToken.has(token)) {
      throw new QualityNotFoundException(`No execution registered for token "${token}"`);
    }
    this.executionsByToken.set(token, execution);
  }

  unregister(token: string): boolean {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      return false;
    }
    this.registry.remove(
      KnowledgeQualityRegistryBucket.ASSESSMENT,
      execution.metadata.assessmentId,
    );
    this.executionsByToken.delete(token);
    return true;
  }

  list(): readonly KnowledgeQualityExecution[] {
    return Array.from(this.executionsByToken.values());
  }

  count(): number {
    return this.executionsByToken.size;
  }

  /* ---- Job Ledger ---- */

  registerJob(job: KnowledgeQualityAssessmentJob): KnowledgeQualityAssessmentJob {
    this.jobsById.set(job.jobId, job);
    return job;
  }

  getJob(jobId: string): KnowledgeQualityAssessmentJob | undefined {
    return this.jobsById.get(jobId);
  }

  requireJob(jobId: string): KnowledgeQualityAssessmentJob {
    const job = this.jobsById.get(jobId);
    if (!job) {
      throw new QualityNotFoundException(`No Job is registered for Job Id "${jobId}"`);
    }
    return job;
  }

  updateJob(job: KnowledgeQualityAssessmentJob): KnowledgeQualityAssessmentJob {
    this.requireJob(job.jobId);
    this.jobsById.set(job.jobId, job);
    return job;
  }

  listJobs(): readonly KnowledgeQualityAssessmentJob[] {
    return Array.from(this.jobsById.values());
  }
}
