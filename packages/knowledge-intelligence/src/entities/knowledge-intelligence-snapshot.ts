export interface KnowledgeIntelligenceSnapshotProps {
  readonly id: string;
  readonly takenAt: number;
  readonly itemCount: number;
  readonly averageHealthScore: number;
  readonly duplicateCount: number;
  readonly gapCount: number;
  readonly recommendationCount: number;
}

/** Immutable point-in-time snapshot of the corpus's overall intelligence posture. */
export class KnowledgeIntelligenceSnapshot {
  readonly id: string;
  readonly takenAt: number;
  readonly itemCount: number;
  readonly averageHealthScore: number;
  readonly duplicateCount: number;
  readonly gapCount: number;
  readonly recommendationCount: number;

  constructor(props: KnowledgeIntelligenceSnapshotProps) {
    if (props.id.trim().length === 0) {
      throw new RangeError("KnowledgeIntelligenceSnapshot: id must not be empty");
    }
    this.id = props.id;
    this.takenAt = props.takenAt;
    this.itemCount = props.itemCount;
    this.averageHealthScore = props.averageHealthScore;
    this.duplicateCount = props.duplicateCount;
    this.gapCount = props.gapCount;
    this.recommendationCount = props.recommendationCount;
    Object.freeze(this);
  }
}
