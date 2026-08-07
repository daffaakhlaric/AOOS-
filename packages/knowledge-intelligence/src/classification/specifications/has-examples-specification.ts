import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when the item declares it has worked examples. */
export class HasExamplesSpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "has_examples";

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    return candidate.hasExamples === true;
  }
}
