import type { IClock } from "../contracts/i-clock.js";
import {
  KnowledgeGapReport,
  type KnowledgeGapEntry,
  type OrphanEntry,
} from "../entities/knowledge-gap-report.js";
import { generateId } from "../utils/id-generator.js";

/** Factory-pattern class constructing `KnowledgeGapReport` aggregates with sensible defaults. */
export class KnowledgeGapReportFactory {
  constructor(private readonly clock: IClock) {}

  create(
    coverageScore: number,
    gaps: readonly KnowledgeGapEntry[],
    orphans: readonly OrphanEntry[],
  ): KnowledgeGapReport {
    return new KnowledgeGapReport({
      id: generateId("gap-report"),
      generatedAt: this.clock.now(),
      coverageScore,
      gaps,
      orphans,
    });
  }
}
