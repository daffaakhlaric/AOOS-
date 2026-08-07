import type { ISpecification } from "../../contracts/i-specification.js";
import type { KnowledgeItemSnapshot } from "../../types/knowledge-item.js";

/** Satisfied when `contentLength <= maxLength`. */
export class ShortFormContentSpecification implements ISpecification<KnowledgeItemSnapshot> {
  readonly name = "short_form_content";

  constructor(private readonly maxLength: number) {}

  isSatisfiedBy(candidate: KnowledgeItemSnapshot): boolean {
    return candidate.contentLength <= this.maxLength;
  }
}
