/** Computed structural statistics for a single `KnowledgeGraph`, produced by `AnalyticsManager`. */
export interface GraphStatistics {
  readonly graphId: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly averageDegree: number;
  readonly connectedComponentCount: number;
  readonly cycleCount: number;
  readonly nodeTypeBreakdown: Readonly<Record<string, number>>;
  readonly edgeTypeBreakdown: Readonly<Record<string, number>>;
  readonly computedAt: number;
}
