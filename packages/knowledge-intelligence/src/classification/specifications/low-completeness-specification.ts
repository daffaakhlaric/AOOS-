import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when the item's required-fields-present ratio is below `maxRatio` (0-1). */
export class LowCompletenessSpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "low_completeness";

  constructor(private readonly maxRatio: number) {}

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    if (candidate.requiredFieldsTotal === 0) return false;
    const ratio = candidate.requiredFieldsPresent / candidate.requiredFieldsTotal;
    return ratio < this.maxRatio;
  }
}
