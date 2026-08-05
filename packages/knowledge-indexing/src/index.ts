/**
 * "PUBLIC API: KnowledgeIndexing, KnowledgeIndexingSystem, KnowledgeIndexer,
 * KnowledgeIndexRegistry, KnowledgeIndexManager, KnowledgeIndexBuilder,
 * KnowledgeIndexValidator, KnowledgeIndexPipeline, KnowledgeIndexContext,
 * KnowledgeIndexFactory, KnowledgeIndexMetrics, KnowledgeIndexHealth,
 * KnowledgeIndexMonitor, KnowledgeIndexEvents, KnowledgeIndexScheduler,
 * KnowledgeIndexOptimizer, KnowledgeIndexStatistics, KnowledgeIndexResolver."
 * (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md). The 18 named exports below, plus the full
 * Domain/Contracts/Errors surface a caller needs to actually build and use them —
 * matching the curation approach established in `@aos/knowledge-engine`/
 * `@aos/knowledge-runtime`.
 */
export { KnowledgeIndexing, type KnowledgeIndexingOptions } from "./indexing/knowledge-indexing.js";

export { KnowledgeIndexingSystem } from "./bootstrap/knowledge-indexing-system.js";

export { KnowledgeIndexer, type IndexAssetInput } from "./indexer/knowledge-indexer.js";

export { KnowledgeIndexRegistry } from "./registry/knowledge-index-registry.js";
export { KnowledgeIndexRegistryBucket } from "./registry/knowledge-index-registry-bucket.js";

export { KnowledgeIndexManager } from "./manager/knowledge-index-manager.js";

export { KnowledgeIndexBuilder } from "./builder/knowledge-index-builder.js";

export { KnowledgeIndexValidator } from "./validator/knowledge-index-validator.js";
export type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationIssue,
  KnowledgeIndexValidationResult,
} from "./validator/i-knowledge-index-validator.js";
export { NamespaceValidator } from "./validator/namespace-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { RelationshipValidator } from "./validator/relationship-validator.js";
export { PolicyValidator } from "./validator/policy-validator.js";
export { PermissionValidator } from "./validator/permission-validator.js";
export { EmbeddingReferenceValidator } from "./validator/embedding-reference-validator.js";
export { DuplicateValidator } from "./validator/duplicate-validator.js";
export { ConsistencyValidator } from "./validator/consistency-validator.js";

export {
  KnowledgeIndexPipeline,
  type KnowledgeIndexPipelineOptions,
  type RunPipelineInput,
} from "./pipeline/knowledge-index-pipeline.js";
export type { IKnowledgeIndexChecker } from "./pipeline/i-index-checker.js";

export {
  knowledgeIndexContextSchema,
  type KnowledgeIndexContext,
} from "./context/knowledge-index-context.js";
export {
  createKnowledgeIndexContext,
  type CreateKnowledgeIndexContextInput,
} from "./context/create-knowledge-index-context.js";

export { KnowledgeIndexFactory } from "./factory/knowledge-index-factory.js";

export { KnowledgeIndexMetrics } from "./metrics/knowledge-index-metrics.js";
export type {
  IKnowledgeIndexMetrics,
  KnowledgeIndexMetricsSnapshot,
} from "./metrics/i-knowledge-index-metrics.js";

export { KnowledgeIndexHealth } from "./health/knowledge-index-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeIndexHealthReport,
} from "./health/i-health-check.js";

export { KnowledgeIndexMonitor } from "./monitoring/knowledge-index-monitor.js";
export type { KnowledgeIndexDashboard } from "./monitoring/knowledge-index-monitor.js";

export { KnowledgeIndexEvents } from "./events/knowledge-index-events.js";
export { KnowledgeIndexEventType } from "./events/knowledge-index-event-type.js";

export {
  KnowledgeIndexScheduler,
  type ScheduleJobInput,
} from "./scheduler/knowledge-index-scheduler.js";
export { KnowledgeIndexScheduleJobType } from "./scheduler/knowledge-index-schedule-job-type.js";
export type { KnowledgeIndexScheduleJob } from "./scheduler/knowledge-index-schedule-job.js";

export { KnowledgeIndexOptimizer } from "./optimizer/knowledge-index-optimizer.js";

export { KnowledgeIndexStatistics } from "./statistics/knowledge-index-statistics.js";

export { KnowledgeIndexResolver } from "./resolver/knowledge-index-resolver.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";

export type { KnowledgeIndexingConfig } from "./config/knowledge-indexing-config.js";
