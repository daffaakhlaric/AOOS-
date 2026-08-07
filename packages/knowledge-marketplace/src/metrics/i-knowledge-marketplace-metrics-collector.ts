export interface KnowledgeMarketplaceMetricsSnapshot {
  readonly packageCount: number;
  readonly publishedCount: number;
  readonly certifiedCount: number;
  readonly categoryCount: number;
  readonly dependencyCount: number;
  readonly compatibilityCount: number;
  readonly publisherCount: number;
  readonly searchCount: number;
  readonly browseCount: number;
  readonly validationCount: number;
  readonly validationFailureCount: number;
}

/** The mutation surface `KnowledgeMarketplacePipeline`'s Metrics stage drives. */
export interface IKnowledgeMarketplaceMetricsCollector {
  recordPackage(): void;
  recordPublished(): void;
  recordCertified(): void;
  recordCategory(): void;
  recordDependency(): void;
  recordCompatibility(): void;
  recordPublisher(): void;
  recordSearch(): void;
  recordBrowse(): void;
  recordValidation(success: boolean): void;
  snapshot(): KnowledgeMarketplaceMetricsSnapshot;
}
