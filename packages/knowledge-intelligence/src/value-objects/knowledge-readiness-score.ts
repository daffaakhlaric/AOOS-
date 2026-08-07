export interface KnowledgeReadinessScoreProps {
  readonly value: number;
  readonly band: string;
  readonly readyItemCount: number;
  readonly totalItemCount: number;
}

/** Immutable corpus-wide readiness score (how much of the corpus meets a "ready" bar). */
export class KnowledgeReadinessScore {
  readonly value: number;
  readonly band: string;
  readonly readyItemCount: number;
  readonly totalItemCount: number;

  constructor(props: KnowledgeReadinessScoreProps) {
    if (props.value < 0 || props.value > 100) {
      throw new RangeError("KnowledgeReadinessScore: value must be within [0, 100]");
    }
    if (props.readyItemCount < 0 || props.readyItemCount > props.totalItemCount) {
      throw new RangeError(
        "KnowledgeReadinessScore: readyItemCount must be within [0, totalItemCount]",
      );
    }
    this.value = props.value;
    this.band = props.band;
    this.readyItemCount = props.readyItemCount;
    this.totalItemCount = props.totalItemCount;
    Object.freeze(this);
  }
}
