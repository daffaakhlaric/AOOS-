import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class RetryExhaustedException extends KnowledgeAutoUpdateException {
  constructor(jobId: string, attempts: number, maxRetries: number) {
    super(`Retries exhausted for job ${jobId}: ${attempts} attempts (max ${maxRetries})`, {
      code: "RETRY_EXHAUSTED",
      context: { jobId, attempts, maxRetries },
    });
  }
}
