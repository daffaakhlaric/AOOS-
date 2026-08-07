import type {
  IKnowledgeValidatorMetricsCollector,
  KnowledgeValidatorMetricsSnapshot,
} from "./i-knowledge-validator-metrics-collector.js";

/**
 * "METRICS: Validation Count, Approved Count, Rejected Count, Decision Count, Rule
 * Usage, Policy Usage, Average Duration, Average Confidence Metadata."
 * (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — a live in-memory snapshot of the 8
 * named counters, computed as a real running average (not a stub), plus internal
 * configuration-usage/finding/check instrumentation for Statistics/Health/Monitoring.
 */
export class KnowledgeValidatorMetrics implements IKnowledgeValidatorMetricsCollector {
  private validationCount = 0;
  private approvedCount = 0;
  private rejectedCount = 0;
  private decisionCount = 0;
  private ruleUsageCount = 0;
  private policyUsageCount = 0;
  private configurationUsageCount = 0;
  private findingCount = 0;
  private totalDurationMs = 0;
  private durationSamples = 0;
  private totalConfidence = 0;
  private confidenceSamples = 0;
  private checkCount = 0;
  private checkFailureCount = 0;

  recordValidation(): void {
    this.validationCount += 1;
  }

  recordApproved(): void {
    this.approvedCount += 1;
  }

  recordRejected(): void {
    this.rejectedCount += 1;
  }

  recordDecision(confidence?: number): void {
    this.decisionCount += 1;
    if (confidence !== undefined) {
      this.totalConfidence += confidence;
      this.confidenceSamples += 1;
    }
  }

  recordRuleUsage(count: number): void {
    this.ruleUsageCount += count;
  }

  recordPolicyUsage(): void {
    this.policyUsageCount += 1;
  }

  recordConfigurationUsage(): void {
    this.configurationUsageCount += 1;
  }

  recordFinding(): void {
    this.findingCount += 1;
  }

  recordDuration(durationMs: number): void {
    this.totalDurationMs += durationMs;
    this.durationSamples += 1;
  }

  recordCheck(success: boolean): void {
    this.checkCount += 1;
    if (!success) {
      this.checkFailureCount += 1;
    }
  }

  snapshot(): KnowledgeValidatorMetricsSnapshot {
    return {
      validationCount: this.validationCount,
      approvedCount: this.approvedCount,
      rejectedCount: this.rejectedCount,
      decisionCount: this.decisionCount,
      ruleUsageCount: this.ruleUsageCount,
      policyUsageCount: this.policyUsageCount,
      averageDurationMs:
        this.durationSamples === 0 ? 0 : this.totalDurationMs / this.durationSamples,
      averageConfidenceMetadata:
        this.confidenceSamples === 0 ? 0 : this.totalConfidence / this.confidenceSamples,
      configurationUsageCount: this.configurationUsageCount,
      findingCount: this.findingCount,
      checkCount: this.checkCount,
      checkFailureCount: this.checkFailureCount,
    };
  }
}
