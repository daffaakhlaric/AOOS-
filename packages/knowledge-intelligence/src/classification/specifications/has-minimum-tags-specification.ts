import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when the item has at least `minTags` tags. */
export class HasMinimumTagsSpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "has_minimum_tags";

  constructor(private readonly minTags: number) {}

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    return candidate.tags.length >= this.minTags;
  }
}
