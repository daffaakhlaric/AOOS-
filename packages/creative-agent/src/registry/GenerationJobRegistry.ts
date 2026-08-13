import type { GenerationJob } from "../domain/entities/GenerationJob.js";
import type { JobId } from "../domain/value-objects/JobId.js";

/**
 * An in-memory `GenerationJob` store — what `GetGenerationStatus` reads and `KaiAgentService`
 * writes to as a `processCreativeBrief` run progresses through `PENDING` -> `GENERATING` ->
 * `READY`/`FAILED`. Mirrors `@aos/ai-judge`'s `GoldenDatasetRegistry` (in-memory, per-factory-
 * instance, no external persistence — Kai has no database of its own per the spec's folder
 * structure, which lists no `infrastructure/` layer).
 */
export class GenerationJobRegistry {
  private readonly jobs = new Map<string, GenerationJob>();

  upsert(job: GenerationJob): void {
    this.jobs.set(job.id.toString(), job);
  }

  get(jobId: JobId): GenerationJob | undefined {
    return this.jobs.get(jobId.toString());
  }

  all(): ReadonlyArray<GenerationJob> {
    return [...this.jobs.values()];
  }
}
