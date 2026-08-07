import type { EmbeddingJob } from "../domain/embedding-job.js";

/** "IEmbeddingScheduler" — interface ONLY. A caller-supplied scheduler that decides when a queued `EmbeddingJob` actually runs. */
export interface IEmbeddingScheduler {
  schedule(job: EmbeddingJob): Promise<void>;
}
