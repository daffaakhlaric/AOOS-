/** A point-in-time snapshot of the package-wide (cross-graph) metrics counters. */
export interface GraphMetrics {
  readonly graphCount: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly relationshipCount: number;
  readonly traversalCount: number;
  readonly averageDegree: number;
  readonly connectedComponents: number;
  readonly cycleCount: number;
  readonly capturedAt: number;
}
