/** Constructor properties for {@link KnowledgeAnalyticsSummary}. */
export interface KnowledgeAnalyticsSummaryProps {
  readonly id: string;
  readonly generatedAt: number;
  readonly totalSamplesRecorded: number;
  readonly totalReportsGenerated: number;
  readonly totalMetricsTracked: number;
  readonly categoryTotals: Readonly<Record<string, number>>;
}

/**
 * Immutable entity: a rollup of this engine's overall operational footprint — how much data has
 * flowed through it and how many artifacts it has produced — as opposed to `KnowledgeDashboardSnapshot`,
 * which is a snapshot of domain metric *values*.
 */
export class KnowledgeAnalyticsSummary {
  public readonly id: string;
  public readonly generatedAt: number;
  public readonly totalSamplesRecorded: number;
  public readonly totalReportsGenerated: number;
  public readonly totalMetricsTracked: number;
  public readonly categoryTotals: Readonly<Record<string, number>>;

  constructor(props: KnowledgeAnalyticsSummaryProps) {
    this.id = props.id;
    this.generatedAt = props.generatedAt;
    this.totalSamplesRecorded = props.totalSamplesRecorded;
    this.totalReportsGenerated = props.totalReportsGenerated;
    this.totalMetricsTracked = props.totalMetricsTracked;
    this.categoryTotals = Object.freeze({ ...props.categoryTotals });
    Object.freeze(this);
  }
}
