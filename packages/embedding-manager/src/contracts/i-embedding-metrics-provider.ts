import type { EmbeddingManagerMetricsSnapshot } from "../metrics/i-embedding-manager-metrics-collector.js";

/** "IEmbeddingMetricsProvider" — interface ONLY. A caller-supplied external metrics sink (Prometheus, Datadog, ...) mirroring `EmbeddingMetrics` snapshots. */
export interface IEmbeddingMetricsProvider {
  publish(snapshot: EmbeddingManagerMetricsSnapshot): Promise<void>;
}
