export interface KnowledgeValidatorMetricsSnapshot {
  readonly validationCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly decisionCount: number;
  readonly ruleUsageCount: number;
  readonly policyUsageCount: number;
  readonly averageDurationMs: number;
  readonly averageConfidenceMetadata: number;
  readonly configurationUsageCount: number;
  readonly findingCount: number;
  readonly checkCount: number;
  readonly checkFailureCount: number;
}

/**
 * The mutation surface `KnowledgeValidatorPipeline`'s Metrics stage (and the Facade's
 * Finding/Decision recording) drives — the exact 8 named counters from "METRICS"
 * (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md: Validation Count, Approved Count,
 * Rejected Count, Decision Count, Rule Usage, Policy Usage, Average Duration, Average
 * Confidence Metadata), plus internal configuration-usage/finding/check
 * instrumentation for Statistics/Health/Monitoring. `checkCount`/`checkFailureCount`
 * track the 12-stage `KnowledgeValidatorValidator`'s pass/fail outcome per Pipeline run
 * — distinct from the named `validationCount` metric (which counts every Pipeline run,
 * mirroring `@aos/knowledge-quality`'s `assessmentCount`/`validationCount` split).
 */
export interface IKnowledgeValidatorMetricsCollector {
  recordValidation(): void;
  recordApproved(): void;
  recordRejected(): void;
  recordDecision(confidence?: number): void;
  recordRuleUsage(count: number): void;
  recordPolicyUsage(): void;
  recordDuration(durationMs: number): void;
  recordConfigurationUsage(): void;
  recordFinding(): void;
  recordCheck(success: boolean): void;
  snapshot(): KnowledgeValidatorMetricsSnapshot;
}
