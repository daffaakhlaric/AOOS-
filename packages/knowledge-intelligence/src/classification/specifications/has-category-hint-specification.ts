import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when the item's caller-supplied `category` hint equals `expectedCategory`. */
export class HasCategoryHintSpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "has_category_hint";

  constructor(private readonly expectedCategory: string) {}

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    return candidate.category?.toLowerCase() === this.expectedCategory.toLowerCase();
  }
}
