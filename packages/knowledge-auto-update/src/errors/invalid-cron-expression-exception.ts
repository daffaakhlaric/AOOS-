import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class InvalidCronExpressionException extends KnowledgeAutoUpdateException {
  constructor(expression: string, reason: string) {
    super(`Invalid cron expression "${expression}": ${reason}`, {
      code: "INVALID_CRON_EXPRESSION",
      context: { expression, reason },
    });
  }
}
