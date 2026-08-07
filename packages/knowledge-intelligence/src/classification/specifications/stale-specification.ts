import type { IClock } from "../../contracts/i-clock.js";
import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when the item's age (via the injected `IClock`) exceeds `maxAgeMs`. */
export class StaleSpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "stale";

  constructor(
    private readonly clock: IClock,
    private readonly maxAgeMs: number,
  ) {}

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    return this.clock.now() - candidate.lastUpdatedAt > this.maxAgeMs;
  }
}
