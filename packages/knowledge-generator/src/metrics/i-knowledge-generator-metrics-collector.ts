export interface KnowledgeGeneratorMetricsSnapshot {
  readonly generationCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly promptUsageCount: number;
  readonly contextUsageCount: number;
  readonly policyUsageCount: number;
  readonly providerUsageCount: number;
  readonly averageDurationMs: number;
  readonly validationCount: number;
  readonly validationFailureCount: number;
}

/**
 * The mutation surface `KnowledgeGeneratorPipeline`'s Metrics stage drives — the exact
 * 8 named counters from "METRICS" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md), plus
 * internal validation instrumentation for Health/Monitoring.
 */
export interface IKnowledgeGeneratorMetricsCollector {
  recordGeneration(): void;
  recordCompleted(): void;
  recordFailed(): void;
  recordPromptUsage(): void;
  recordContextUsage(): void;
  recordPolicyUsage(): void;
  recordProviderUsage(): void;
  recordDuration(durationMs: number): void;
  recordValidation(success: boolean): void;
  snapshot(): KnowledgeGeneratorMetricsSnapshot;
}
