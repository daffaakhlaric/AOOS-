import type { KnowledgeSourceMetricsSnapshot } from "../metrics/i-knowledge-source-metrics-collector.js";

/**
 * Interface only — no implementation in this package. The Extension Point for an
 * external pluggable metrics sink (e.g. forwarding a `KnowledgeSourceMetricsSnapshot` to
 * a real observability backend). Named `IKnowledgeSourceMetrics` per the prompt's
 * Extension Points list; the internal collector `KnowledgeSourceMetrics` implements the
 * separate `IKnowledgeSourceMetricsCollector` shape in `metrics/i-knowledge-source-metrics-collector.ts`
 * — the same naming-collision resolution `@aos/knowledge-provider` used.
 */
export interface IKnowledgeSourceMetrics {
  publish(snapshot: KnowledgeSourceMetricsSnapshot): void | Promise<void>;
}
