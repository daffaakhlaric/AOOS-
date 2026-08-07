import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when `contentLength >= minLength`. */
export class LongFormContentSpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "long_form_content";

  constructor(private readonly minLength: number) {}

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    return candidate.contentLength >= this.minLength;
  }
}
