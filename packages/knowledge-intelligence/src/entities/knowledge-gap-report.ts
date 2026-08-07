export interface KnowledgeGapEntry {
  readonly topic: string;
  readonly itemCount: number;
}

export interface OrphanEntry {
  readonly itemId: string;
}

export interface KnowledgeGapReportProps {
  readonly id: string;
  readonly generatedAt: number;
  readonly coverageScore: number;
  readonly gaps: readonly KnowledgeGapEntry[];
  readonly orphans: readonly OrphanEntry[];
}

/** Immutable gap-analysis report aggregate: uncovered topics plus orphaned (edge-less) items. */
export class KnowledgeGapReport {
  readonly id: string;
  readonly generatedAt: number;
  readonly coverageScore: number;
  readonly gaps: readonly KnowledgeGapEntry[];
  readonly orphans: readonly OrphanEntry[];

  constructor(props: KnowledgeGapReportProps) {
    if (props.coverageScore < 0 || props.coverageScore > 100) {
      throw new RangeError("KnowledgeGapReport: coverageScore must be within [0, 100]");
    }
    this.id = props.id;
    this.generatedAt = props.generatedAt;
    this.coverageScore = props.coverageScore;
    this.gaps = props.gaps;
    this.orphans = props.orphans;
    Object.freeze(this);
    Object.freeze(this.gaps);
    Object.freeze(this.orphans);
  }
}
