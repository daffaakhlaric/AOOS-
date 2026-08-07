import type { KnowledgeQualityMetricsSnapshot } from "../metrics/i-knowledge-quality-metrics-collector.js";

/**
 * "IKnowledgeQualityMetricsProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied external
 * metrics sink (e.g. Prometheus/OTel) that mirrors a `KnowledgeQualityMetricsSnapshot`.
 * Distinct from the internal `IKnowledgeQualityMetricsCollector` this package's own
 * `KnowledgeQualityMetrics` implements.
 */
export interface IKnowledgeQualityMetricsProvider {
  publish(snapshot: KnowledgeQualityMetricsSnapshot): Promise<void>;
}
