import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class DependencyNotSatisfiedException extends KnowledgeAutoUpdateException {
  constructor(jobId: string, blockedOn: readonly string[]) {
    super(`Job ${jobId} is blocked on unfinished dependencies: ${blockedOn.join(", ")}`, {
      code: "DEPENDENCY_NOT_SATISFIED",
      context: { jobId, blockedOn },
    });
  }
}
