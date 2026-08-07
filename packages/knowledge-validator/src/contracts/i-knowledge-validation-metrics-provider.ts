import type { KnowledgeValidatorMetricsSnapshot } from "../metrics/i-knowledge-validator-metrics-collector.js";

/**
 * "IKnowledgeValidationMetricsProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied external
 * metrics sink (e.g. Prometheus/OTel) that mirrors a `KnowledgeValidatorMetricsSnapshot`.
 * Distinct from the internal `IKnowledgeValidatorMetricsCollector` this package's own
 * `KnowledgeValidatorMetrics` implements.
 */
export interface IKnowledgeValidationMetricsProvider {
  publish(snapshot: KnowledgeValidatorMetricsSnapshot): Promise<void>;
}
