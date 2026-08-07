import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when the item declares it has a summary. */
export class HasSummarySpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "has_summary";

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    return candidate.hasSummary === true;
  }
}
