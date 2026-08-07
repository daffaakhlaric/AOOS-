import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class SessionNotFoundException extends KnowledgeAutoUpdateException {
  constructor(sessionId: string) {
    super(`Knowledge update session not found: ${sessionId}`, {
      code: "SESSION_NOT_FOUND",
      context: { sessionId },
    });
  }
}
