export interface KnowledgeQualityMetricsSnapshot {
  readonly assessmentCount: number;
  readonly findingCount: number;
  readonly ruleUsageCount: number;
  readonly profileUsageCount: number;
  readonly averageDurationMs: number;
  readonly averageScoreMetadata: number;
  readonly policyUsageCount: number;
  readonly configurationUsageCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly validationCount: number;
  readonly validationFailureCount: number;
}

/**
 * The mutation surface `KnowledgeQualityPipeline`'s Metrics stage (and the Facade's
 * Finding/Score recording) drives — the exact 8 named counters from "METRICS"
 * (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md: Assessment Count, Finding Count, Rule
 * Count, Profile Count, Average Duration, Average Score Metadata, Policy Usage,
 * Configuration Usage), plus internal completed/failed/validation instrumentation for
 * Statistics/Health/Monitoring.
 */
export interface IKnowledgeQualityMetricsCollector {
  recordAssessment(): void;
  recordFinding(): void;
  recordRuleUsage(count: number): void;
  recordProfileUsage(): void;
  recordDuration(durationMs: number): void;
  recordScore(value: number): void;
  recordPolicyUsage(): void;
  recordConfigurationUsage(): void;
  recordCompleted(): void;
  recordFailed(): void;
  recordValidation(success: boolean): void;
  snapshot(): KnowledgeQualityMetricsSnapshot;
}
