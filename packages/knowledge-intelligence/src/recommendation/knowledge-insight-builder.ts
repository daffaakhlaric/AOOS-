import type { IClock } from "../contracts/i-clock.js";
import { generateId } from "../utils/id-generator.js";
import {
  KnowledgeInsight,
  type KnowledgeInsightSeverity,
} from "../value-objects/knowledge-insight.js";

export interface BuildInsightInput {
  readonly title: string;
  readonly description: string;
  readonly severity: KnowledgeInsightSeverity;
  readonly relatedItemIds?: readonly string[];
}

/** Builder-pattern helper constructing `KnowledgeInsight` value objects with defaults. */
export class KnowledgeInsightBuilder {
  constructor(private readonly clock: IClock) {}

  build(input: BuildInsightInput): KnowledgeInsight {
    return new KnowledgeInsight({
      id: generateId("insight"),
      title: input.title,
      description: input.description,
      severity: input.severity,
      relatedItemIds: input.relatedItemIds ?? [],
      createdAt: this.clock.now(),
    });
  }
}
