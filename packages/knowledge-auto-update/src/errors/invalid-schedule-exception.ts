import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class InvalidScheduleException extends KnowledgeAutoUpdateException {
  constructor(reason: string, context?: Readonly<Record<string, unknown>>) {
    super(`Invalid schedule descriptor: ${reason}`, {
      code: "INVALID_SCHEDULE",
      context,
    });
  }
}
