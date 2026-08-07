import { KnowledgeIntelligenceException } from "./knowledge-intelligence-exception.js";

export class RecommendationNotFoundException extends KnowledgeIntelligenceException {
  constructor(recommendationId: string) {
    super(`Knowledge recommendation not found: ${recommendationId}`, {
      code: "RECOMMENDATION_NOT_FOUND",
      context: { recommendationId },
    });
  }
}
