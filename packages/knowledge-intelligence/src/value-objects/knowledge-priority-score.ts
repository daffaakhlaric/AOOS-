export interface KnowledgePriorityScoreProps {
  readonly itemId: string;
  readonly value: number;
  readonly band: string;
}

/** Immutable per-item priority score (higher = more urgent to act on). */
export class KnowledgePriorityScore {
  readonly itemId: string;
  readonly value: number;
  readonly band: string;

  constructor(props: KnowledgePriorityScoreProps) {
    if (props.value < 0 || props.value > 100) {
      throw new RangeError("KnowledgePriorityScore: value must be within [0, 100]");
    }
    this.itemId = props.itemId;
    this.value = props.value;
    this.band = props.band;
    Object.freeze(this);
  }
}
