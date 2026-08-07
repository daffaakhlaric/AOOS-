import type { EmbeddingExecution } from "../domain/embedding-execution.js";
import type { EmbeddingJob } from "../domain/embedding-job.js";
import { EmbeddingNotFoundException } from "../errors/embedding-not-found-exception.js";
import { EmbeddingRegistryBucket } from "../registry/embedding-registry-bucket.js";
import type { EmbeddingRegistryEntry } from "../registry/embedding-registry-entry.js";
import type { EmbeddingRegistry } from "../registry/embedding-registry.js";
import type { EmbeddingSession } from "../session/embedding-session.js";
import { EmbeddingStatistics } from "../statistics/embedding-statistics.js";

/**
 * "EmbeddingManagerLedger" — the internal, NOT publicly re-exported mid-level
 * orchestrator composing Registry + Session + Statistics + executionsByToken
 * (token-keyed ledger; Map lookups only, never array-scan). Also owns the Job and
 * Configuration ledgers (Jobs/Configurations are NOT Registry buckets — see
 * docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Registry"/"Technical Debt").
 *
 * NAMING-COLLISION RESOLUTION: the spec's own Package Structure lists both a
 * `manager/` folder AND an `embedding/` folder as siblings, mirroring the established
 * `manager/` (composition) + `<domain-name>/` (public facade) split from
 * `knowledge-validator`/`knowledge-quality`. But this package's Public API has ONLY
 * `EmbeddingManager` as the single top-level orchestrator name — there is no second
 * "manager" name available. This class is therefore deliberately named
 * `EmbeddingManagerLedger` (internal-sounding, NOT `EmbeddingManager`) and is kept OUT
 * of `src/index.ts`'s curated exports; the actual Public API class literally named
 * `EmbeddingManager` lives in `embedding/embedding-manager.ts` and composes THIS class
 * as one of its internal collaborators alongside the StateMachine/Pipeline/Middleware/
 * Resolver. Configuration records are NOT re-duplicated here — they live solely on
 * `EmbeddingResolver`'s dedicated map (see docs/005.7N-EMBEDDING-MANAGER-REPORT.md —
 * "Architecture"/"Technical Debt" for the full judgment call).
 */
export class EmbeddingManagerLedger {
  private readonly executionsByToken = new Map<string, EmbeddingExecution>();
  private readonly jobsById = new Map<string, EmbeddingJob>();
  readonly statistics = new EmbeddingStatistics();

  constructor(
    readonly registry: EmbeddingRegistry,
    readonly session: EmbeddingSession,
  ) {}

  register(token: string, execution: EmbeddingExecution, entry: EmbeddingRegistryEntry): void {
    this.registry.register(EmbeddingRegistryBucket.EMBEDDING, entry);
    this.executionsByToken.set(token, execution);
    this.statistics.recordRequested(execution.request.providerType);
  }

  get(token: string): EmbeddingExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): EmbeddingExecution {
    const execution = this.get(token);
    if (!execution) {
      throw new EmbeddingNotFoundException(`No execution registered for token "${token}"`);
    }
    return execution;
  }

  update(token: string, execution: EmbeddingExecution): void {
    if (!this.executionsByToken.has(token)) {
      throw new EmbeddingNotFoundException(`No execution registered for token "${token}"`);
    }
    this.executionsByToken.set(token, execution);
  }

  unregister(token: string): boolean {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      return false;
    }
    this.registry.remove(EmbeddingRegistryBucket.EMBEDDING, execution.metadata.embeddingId);
    this.executionsByToken.delete(token);
    return true;
  }

  list(): readonly EmbeddingExecution[] {
    return Array.from(this.executionsByToken.values());
  }

  count(): number {
    return this.executionsByToken.size;
  }

  /* ---- Job Ledger ---- */

  registerJob(job: EmbeddingJob): EmbeddingJob {
    this.jobsById.set(job.jobId, job);
    return job;
  }

  getJob(jobId: string): EmbeddingJob | undefined {
    return this.jobsById.get(jobId);
  }

  requireJob(jobId: string): EmbeddingJob {
    const job = this.jobsById.get(jobId);
    if (!job) {
      throw new EmbeddingNotFoundException(`No Job is registered for Job Id "${jobId}"`);
    }
    return job;
  }

  updateJob(job: EmbeddingJob): EmbeddingJob {
    this.requireJob(job.jobId);
    this.jobsById.set(job.jobId, job);
    return job;
  }

  listJobs(): readonly EmbeddingJob[] {
    return Array.from(this.jobsById.values());
  }
}
