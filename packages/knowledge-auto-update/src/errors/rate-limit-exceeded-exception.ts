import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class RateLimitExceededException extends KnowledgeAutoUpdateException {
  constructor(scopeId: string, limit: number, windowMs: number) {
    super(`Rate limit exceeded for ${scopeId}: max ${limit} updates per ${windowMs}ms`, {
      code: "RATE_LIMIT_EXCEEDED",
      context: { scopeId, limit, windowMs },
    });
  }
}
