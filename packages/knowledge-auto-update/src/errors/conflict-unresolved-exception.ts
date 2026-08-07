import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class ConflictUnresolvedException extends KnowledgeAutoUpdateException {
  constructor(jobId: string, reason: string) {
    super(`Conflict could not be resolved for job ${jobId}: ${reason}`, {
      code: "CONFLICT_UNRESOLVED",
      context: { jobId, reason },
    });
  }
}
