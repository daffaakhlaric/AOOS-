import type { KnowledgeCategory } from "../types/knowledge-category.js";

export interface KnowledgeClassificationProps {
  readonly itemId: string;
  readonly category: KnowledgeCategory;
  readonly confidence: number;
  readonly matchedSpecifications: readonly string[];
}

/** Immutable classification outcome for one knowledge item. */
export class KnowledgeClassification {
  readonly itemId: string;
  readonly category: KnowledgeCategory;
  readonly confidence: number;
  readonly matchedSpecifications: readonly string[];

  constructor(props: KnowledgeClassificationProps) {
    if (props.confidence < 0 || props.confidence > 1) {
      throw new RangeError("KnowledgeClassification: confidence must be within [0, 1]");
    }
    this.itemId = props.itemId;
    this.category = props.category;
    this.confidence = props.confidence;
    this.matchedSpecifications = props.matchedSpecifications;
    Object.freeze(this);
    Object.freeze(this.matchedSpecifications);
  }
}
