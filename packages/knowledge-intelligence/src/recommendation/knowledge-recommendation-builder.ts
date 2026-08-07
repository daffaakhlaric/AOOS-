import type { IClock } from "../contracts/i-clock.js";
import type { RecommendationType } from "../types/recommendation-type.js";
import { generateId } from "../utils/id-generator.js";
import { KnowledgeRecommendation } from "../value-objects/knowledge-recommendation.js";

export interface BuildRecommendationInput {
  readonly type: RecommendationType;
  readonly itemIds: readonly string[];
  readonly reason: string;
  readonly priority?: number;
}

/** Builder-pattern helper constructing `KnowledgeRecommendation` value objects with defaults. */
export class KnowledgeRecommendationBuilder {
  constructor(private readonly clock: IClock) {}

  build(input: BuildRecommendationInput): KnowledgeRecommendation {
    return new KnowledgeRecommendation({
      id: generateId("recommendation"),
      type: input.type,
      itemIds: input.itemIds,
      reason: input.reason,
      priority: input.priority ?? 50,
      createdAt: this.clock.now(),
    });
  }
}
