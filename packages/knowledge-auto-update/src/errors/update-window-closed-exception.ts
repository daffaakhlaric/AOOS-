import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class UpdateWindowClosedException extends KnowledgeAutoUpdateException {
  constructor(jobId: string, hourUtc: number) {
    super(`Update window closed for job ${jobId} at hour ${hourUtc} UTC`, {
      code: "UPDATE_WINDOW_CLOSED",
      context: { jobId, hourUtc },
    });
  }
}
