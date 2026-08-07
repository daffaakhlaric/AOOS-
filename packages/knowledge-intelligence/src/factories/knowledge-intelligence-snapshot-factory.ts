import type { IClock } from "../contracts/i-clock.js";
import { KnowledgeIntelligenceSnapshot } from "../entities/knowledge-intelligence-snapshot.js";
import { generateId } from "../utils/id-generator.js";

export interface CreateSnapshotInput {
  readonly itemCount: number;
  readonly averageHealthScore: number;
  readonly duplicateCount: number;
  readonly gapCount: number;
  readonly recommendationCount: number;
}

/** Factory-pattern class constructing `KnowledgeIntelligenceSnapshot` aggregates. */
export class KnowledgeIntelligenceSnapshotFactory {
  constructor(private readonly clock: IClock) {}

  create(input: CreateSnapshotInput): KnowledgeIntelligenceSnapshot {
    return new KnowledgeIntelligenceSnapshot({
      id: generateId("snapshot"),
      takenAt: this.clock.now(),
      itemCount: input.itemCount,
      averageHealthScore: input.averageHealthScore,
      duplicateCount: input.duplicateCount,
      gapCount: input.gapCount,
      recommendationCount: input.recommendationCount,
    });
  }
}
