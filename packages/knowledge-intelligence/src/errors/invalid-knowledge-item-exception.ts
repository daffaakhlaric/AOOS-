import { KnowledgeIntelligenceException } from "./knowledge-intelligence-exception.js";

export class InvalidKnowledgeItemException extends KnowledgeIntelligenceException {
  constructor(itemId: string, reason: string) {
    super(`Invalid knowledge item ${itemId}: ${reason}`, {
      code: "INVALID_KNOWLEDGE_ITEM",
      context: { itemId, reason },
    });
  }
}
