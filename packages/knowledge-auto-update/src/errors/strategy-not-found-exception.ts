import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class StrategyNotFoundException extends KnowledgeAutoUpdateException {
  constructor(updateType: string) {
    super(`No update strategy registered for update type: ${updateType}`, {
      code: "STRATEGY_NOT_FOUND",
      context: { updateType },
    });
  }
}
