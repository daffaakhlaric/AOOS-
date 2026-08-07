/** A single connected component discovered by the Connected Components algorithm. */
export interface GraphCluster {
  readonly id: string;
  readonly nodeIds: readonly string[];
  readonly size: number;
}
