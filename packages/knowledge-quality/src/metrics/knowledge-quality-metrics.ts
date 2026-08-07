import type {
  IKnowledgeQualityMetricsCollector,
  KnowledgeQualityMetricsSnapshot,
} from "./i-knowledge-quality-metrics-collector.js";

/**
 * "METRICS: Assessment Count, Finding Count, Rule Count, Profile Count, Average
 * Duration, Average Score Metadata, Policy Usage, Configuration Usage."
 * (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — a live in-memory snapshot of the 8
 * named counters, computed as a real running average (not a stub), plus internal
 * completed/failed/validation instrumentation for Statistics/Health/Monitoring.
 */
export class KnowledgeQualityMetrics implements IKnowledgeQualityMetricsCollector {
  private assessmentCount = 0;
  private findingCount = 0;
  private ruleUsageCount = 0;
  private profileUsageCount = 0;
  private policyUsageCount = 0;
  private configurationUsageCount = 0;
  private completedCount = 0;
  private failedCount = 0;
  private totalDurationMs = 0;
  private durationSamples = 0;
  private totalScore = 0;
  private scoreSamples = 0;
  private validationCount = 0;
  private validationFailureCount = 0;

  recordAssessment(): void {
    this.assessmentCount += 1;
  }

  recordFinding(): void {
    this.findingCount += 1;
  }

  recordRuleUsage(count: number): void {
    this.ruleUsageCount += count;
  }

  recordProfileUsage(): void {
    this.profileUsageCount += 1;
  }

  recordPolicyUsage(): void {
    this.policyUsageCount += 1;
  }

  recordConfigurationUsage(): void {
    this.configurationUsageCount += 1;
  }

  recordCompleted(): void {
    this.completedCount += 1;
  }

  recordFailed(): void {
    this.failedCount += 1;
  }

  recordDuration(durationMs: number): void {
    this.totalDurationMs += durationMs;
    this.durationSamples += 1;
  }

  recordScore(value: number): void {
    this.totalScore += value;
    this.scoreSamples += 1;
  }

  recordValidation(success: boolean): void {
    this.validationCount += 1;
    if (!success) {
      this.validationFailureCount += 1;
    }
  }

  snapshot(): KnowledgeQualityMetricsSnapshot {
    return {
      assessmentCount: this.assessmentCount,
      findingCount: this.findingCount,
      ruleUsageCount: this.ruleUsageCount,
      profileUsageCount: this.profileUsageCount,
      averageDurationMs:
        this.durationSamples === 0 ? 0 : this.totalDurationMs / this.durationSamples,
      averageScoreMetadata: this.scoreSamples === 0 ? 0 : this.totalScore / this.scoreSamples,
      policyUsageCount: this.policyUsageCount,
      configurationUsageCount: this.configurationUsageCount,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      validationCount: this.validationCount,
      validationFailureCount: this.validationFailureCount,
    };
  }
}
