export type KnowledgeInsightSeverity = "info" | "warning" | "critical";

export interface KnowledgeInsightProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: KnowledgeInsightSeverity;
  readonly relatedItemIds: readonly string[];
  readonly createdAt: number;
}

/** Immutable corpus-level observation surfaced by `KnowledgeInsightEngine`. */
export class KnowledgeInsight {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: KnowledgeInsightSeverity;
  readonly relatedItemIds: readonly string[];
  readonly createdAt: number;

  constructor(props: KnowledgeInsightProps) {
    if (props.title.trim().length === 0) {
      throw new RangeError("KnowledgeInsight: title must not be empty");
    }
    this.id = props.id;
    this.title = props.title;
    this.description = props.description;
    this.severity = props.severity;
    this.relatedItemIds = props.relatedItemIds;
    this.createdAt = props.createdAt;
    Object.freeze(this);
    Object.freeze(this.relatedItemIds);
  }
}
