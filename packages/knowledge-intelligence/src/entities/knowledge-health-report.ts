import type { KnowledgeHealthScore } from "../value-objects/knowledge-health-score.js";

export interface KnowledgeHealthReportProps {
  readonly id: string;
  readonly generatedAt: number;
  readonly overallScore: KnowledgeHealthScore;
  readonly itemScores: readonly { readonly itemId: string; readonly score: KnowledgeHealthScore }[];
}

/** Immutable corpus-wide health report aggregate: an overall score plus per-item breakdowns. */
export class KnowledgeHealthReport {
  readonly id: string;
  readonly generatedAt: number;
  readonly overallScore: KnowledgeHealthScore;
  readonly itemScores: readonly { readonly itemId: string; readonly score: KnowledgeHealthScore }[];

  constructor(props: KnowledgeHealthReportProps) {
    if (props.id.trim().length === 0) {
      throw new RangeError("KnowledgeHealthReport: id must not be empty");
    }
    this.id = props.id;
    this.generatedAt = props.generatedAt;
    this.overallScore = props.overallScore;
    this.itemScores = props.itemScores;
    Object.freeze(this);
    Object.freeze(this.itemScores);
  }
}
