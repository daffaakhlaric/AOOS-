/** Constructor properties for {@link KnowledgeDashboardSnapshot}. */
export interface KnowledgeDashboardSnapshotProps {
  readonly id: string;
  readonly generatedAt: number;
  readonly metrics: Readonly<Record<string, number>>;
}

/**
 * Immutable entity: a point-in-time snapshot of key metrics across every analytics service, taken
 * by pipeline stage 5 ("Generate Dashboard Snapshot"). Never mutated after creation — a new
 * snapshot is produced on every pipeline run.
 */
export class KnowledgeDashboardSnapshot {
  public readonly id: string;
  public readonly generatedAt: number;
  public readonly metrics: Readonly<Record<string, number>>;

  constructor(props: KnowledgeDashboardSnapshotProps) {
    this.id = props.id;
    this.generatedAt = props.generatedAt;
    this.metrics = Object.freeze({ ...props.metrics });
    Object.freeze(this);
  }

  metric(name: string): number | undefined {
    return this.metrics[name];
  }
}
