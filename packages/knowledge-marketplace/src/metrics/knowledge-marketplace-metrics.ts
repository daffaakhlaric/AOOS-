import type {
  IKnowledgeMarketplaceMetricsCollector,
  KnowledgeMarketplaceMetricsSnapshot,
} from "./i-knowledge-marketplace-metrics-collector.js";

/**
 * "METRICS: Collect: Package Count, Published Count, Certified Count, Category Count,
 * Dependency Count, Compatibility Count, Publisher Count, Search Count, Browse Count."
 * (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — a live in-memory snapshot of the 9
 * named counters, plus internal validation instrumentation for Health/Monitoring.
 */
export class KnowledgeMarketplaceMetrics implements IKnowledgeMarketplaceMetricsCollector {
  private packageCount = 0;
  private publishedCount = 0;
  private certifiedCount = 0;
  private categoryCount = 0;
  private dependencyCount = 0;
  private compatibilityCount = 0;
  private publisherCount = 0;
  private searchCount = 0;
  private browseCount = 0;
  private validationCount = 0;
  private validationFailureCount = 0;

  recordPackage(): void {
    this.packageCount += 1;
  }

  recordPublished(): void {
    this.publishedCount += 1;
  }

  recordCertified(): void {
    this.certifiedCount += 1;
  }

  recordCategory(): void {
    this.categoryCount += 1;
  }

  recordDependency(): void {
    this.dependencyCount += 1;
  }

  recordCompatibility(): void {
    this.compatibilityCount += 1;
  }

  recordPublisher(): void {
    this.publisherCount += 1;
  }

  recordSearch(): void {
    this.searchCount += 1;
  }

  recordBrowse(): void {
    this.browseCount += 1;
  }

  recordValidation(success: boolean): void {
    this.validationCount += 1;
    if (!success) {
      this.validationFailureCount += 1;
    }
  }

  snapshot(): KnowledgeMarketplaceMetricsSnapshot {
    return {
      packageCount: this.packageCount,
      publishedCount: this.publishedCount,
      certifiedCount: this.certifiedCount,
      categoryCount: this.categoryCount,
      dependencyCount: this.dependencyCount,
      compatibilityCount: this.compatibilityCount,
      publisherCount: this.publisherCount,
      searchCount: this.searchCount,
      browseCount: this.browseCount,
      validationCount: this.validationCount,
      validationFailureCount: this.validationFailureCount,
    };
  }
}
