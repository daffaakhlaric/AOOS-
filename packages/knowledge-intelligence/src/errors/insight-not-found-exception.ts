import { KnowledgeIntelligenceException } from "./knowledge-intelligence-exception.js";

export class InsightNotFoundException extends KnowledgeIntelligenceException {
  constructor(insightId: string) {
    super(`Knowledge insight not found: ${insightId}`, {
      code: "INSIGHT_NOT_FOUND",
      context: { insightId },
    });
  }
}
