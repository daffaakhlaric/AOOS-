import type {
  IKnowledgeGeneratorMetricsCollector,
  KnowledgeGeneratorMetricsSnapshot,
} from "./i-knowledge-generator-metrics-collector.js";

/**
 * "METRICS: Generation Count, Completed Count, Failed Count, Prompt Usage, Context
 * Usage, Policy Usage, Provider Usage, Average Duration." (docs/PROMPT-005.7K-
 * KNOWLEDGE-GENERATOR.md) — a live in-memory snapshot of the 8 named counters, computed
 * as a real running average (not a stub), plus internal validation instrumentation for
 * Health/Monitoring.
 */
export class KnowledgeGeneratorMetrics implements IKnowledgeGeneratorMetricsCollector {
  private generationCount = 0;
  private completedCount = 0;
  private failedCount = 0;
  private promptUsageCount = 0;
  private contextUsageCount = 0;
  private policyUsageCount = 0;
  private providerUsageCount = 0;
  private totalDurationMs = 0;
  private durationSamples = 0;
  private validationCount = 0;
  private validationFailureCount = 0;

  recordGeneration(): void {
    this.generationCount += 1;
  }

  recordCompleted(): void {
    this.completedCount += 1;
  }

  recordFailed(): void {
    this.failedCount += 1;
  }

  recordPromptUsage(): void {
    this.promptUsageCount += 1;
  }

  recordContextUsage(): void {
    this.contextUsageCount += 1;
  }

  recordPolicyUsage(): void {
    this.policyUsageCount += 1;
  }

  recordProviderUsage(): void {
    this.providerUsageCount += 1;
  }

  recordDuration(durationMs: number): void {
    this.totalDurationMs += durationMs;
    this.durationSamples += 1;
  }

  recordValidation(success: boolean): void {
    this.validationCount += 1;
    if (!success) {
      this.validationFailureCount += 1;
    }
  }

  snapshot(): KnowledgeGeneratorMetricsSnapshot {
    return {
      generationCount: this.generationCount,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      promptUsageCount: this.promptUsageCount,
      contextUsageCount: this.contextUsageCount,
      policyUsageCount: this.policyUsageCount,
      providerUsageCount: this.providerUsageCount,
      averageDurationMs:
        this.durationSamples === 0 ? 0 : this.totalDurationMs / this.durationSamples,
      validationCount: this.validationCount,
      validationFailureCount: this.validationFailureCount,
    };
  }
}
