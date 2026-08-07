export type KnowledgeFindingSeverity = "info" | "warning" | "critical";

export interface KnowledgeFindingProps {
  readonly id: string;
  readonly itemId: string;
  readonly category: string;
  readonly message: string;
  readonly severity: KnowledgeFindingSeverity;
}

/** Immutable single-item structural/quality observation produced during structure analysis. */
export class KnowledgeFinding {
  readonly id: string;
  readonly itemId: string;
  readonly category: string;
  readonly message: string;
  readonly severity: KnowledgeFindingSeverity;

  constructor(props: KnowledgeFindingProps) {
    if (props.message.trim().length === 0) {
      throw new RangeError("KnowledgeFinding: message must not be empty");
    }
    this.id = props.id;
    this.itemId = props.itemId;
    this.category = props.category;
    this.message = props.message;
    this.severity = props.severity;
    Object.freeze(this);
  }
}
