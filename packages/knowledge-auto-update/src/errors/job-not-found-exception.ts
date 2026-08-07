import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class JobNotFoundException extends KnowledgeAutoUpdateException {
  constructor(jobId: string) {
    super(`Knowledge update job not found: ${jobId}`, {
      code: "JOB_NOT_FOUND",
      context: { jobId },
    });
  }
}
