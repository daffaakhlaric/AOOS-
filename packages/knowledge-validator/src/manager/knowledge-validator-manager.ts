import type { KnowledgeValidationExecution } from "../domain/knowledge-validation-execution.js";
import type { KnowledgeValidationJob } from "../domain/knowledge-validation-job.js";
import { ValidatorNotFoundException } from "../errors/validator-not-found-exception.js";
import { KnowledgeValidatorRegistryBucket } from "../registry/knowledge-validator-registry-bucket.js";
import type { KnowledgeValidatorRegistryEntry } from "../registry/knowledge-validator-registry-entry.js";
import type { KnowledgeValidatorRegistry } from "../registry/knowledge-validator-registry.js";
import type { KnowledgeValidatorSession } from "../session/knowledge-validator-session.js";
import { KnowledgeValidatorStatistics } from "../statistics/knowledge-validator-statistics.js";

/**
 * "KnowledgeValidatorManager" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — mid-level orchestrator composing Registry + Session + Statistics +
 * executionsByToken (token-keyed ledger; Map lookups only, never array-scan). Also owns
 * the Job ledger — Jobs are NOT a Registry bucket (the spec's 8 buckets do not include
 * JOB), so `KnowledgeValidationJob` records live in a dedicated `jobsById` Map here
 * instead, matching the Session-ledger convention.
 */
export class KnowledgeValidatorManager {
  private readonly executionsByToken = new Map<string, KnowledgeValidationExecution>();
  private readonly jobsById = new Map<string, KnowledgeValidationJob>();
  readonly statistics = new KnowledgeValidatorStatistics();

  constructor(
    readonly registry: KnowledgeValidatorRegistry,
    readonly session: KnowledgeValidatorSession,
  ) {}

  register(
    token: string,
    execution: KnowledgeValidationExecution,
    entry: KnowledgeValidatorRegistryEntry,
  ): void {
    this.registry.register(KnowledgeValidatorRegistryBucket.VALIDATION, entry);
    this.executionsByToken.set(token, execution);
    this.statistics.recordRequested(execution.request.category);
  }

  get(token: string): KnowledgeValidationExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeValidationExecution {
    const execution = this.get(token);
    if (!execution) {
      throw new ValidatorNotFoundException(`No execution registered for token "${token}"`);
    }
    return execution;
  }

  update(token: string, execution: KnowledgeValidationExecution): void {
    if (!this.executionsByToken.has(token)) {
      throw new ValidatorNotFoundException(`No execution registered for token "${token}"`);
    }
    this.executionsByToken.set(token, execution);
  }

  unregister(token: string): boolean {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      return false;
    }
    this.registry.remove(
      KnowledgeValidatorRegistryBucket.VALIDATION,
      execution.metadata.validationId,
    );
    this.executionsByToken.delete(token);
    return true;
  }

  list(): readonly KnowledgeValidationExecution[] {
    return Array.from(this.executionsByToken.values());
  }

  count(): number {
    return this.executionsByToken.size;
  }

  /* ---- Job Ledger ---- */

  registerJob(job: KnowledgeValidationJob): KnowledgeValidationJob {
    this.jobsById.set(job.jobId, job);
    return job;
  }

  getJob(jobId: string): KnowledgeValidationJob | undefined {
    return this.jobsById.get(jobId);
  }

  requireJob(jobId: string): KnowledgeValidationJob {
    const job = this.jobsById.get(jobId);
    if (!job) {
      throw new ValidatorNotFoundException(`No Job is registered for Job Id "${jobId}"`);
    }
    return job;
  }

  updateJob(job: KnowledgeValidationJob): KnowledgeValidationJob {
    this.requireJob(job.jobId);
    this.jobsById.set(job.jobId, job);
    return job;
  }

  listJobs(): readonly KnowledgeValidationJob[] {
    return Array.from(this.jobsById.values());
  }
}
