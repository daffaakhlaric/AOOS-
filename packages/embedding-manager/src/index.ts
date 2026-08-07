/**
 * "PUBLIC API: EmbeddingManager, EmbeddingManagerSystem, EmbeddingRegistry,
 * EmbeddingResolver, EmbeddingValidator, EmbeddingPipeline, EmbeddingMiddleware,
 * EmbeddingFactory, EmbeddingContext, EmbeddingSession, EmbeddingLifecycle,
 * EmbeddingStateMachine, EmbeddingEvents, EmbeddingMetrics, EmbeddingHealth,
 * EmbeddingMonitoring, EmbeddingStatistics." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md).
 * The 17 named exports below, plus the full Domain/Contracts/Errors/Validator-stage
 * surface a caller needs to actually build and use them — matching the curation
 * approach established by every prior AOS Knowledge package. `EmbeddingManager` is the
 * façade (`embedding/embedding-manager.ts`); the read-only per-embedding domain view it
 * returns is exported separately as `EmbeddingRecord` (`domain/embedding-record.ts`) to
 * avoid a same-name collision. The internal composition class
 * `EmbeddingManagerLedger` (`manager/embedding-manager-ledger.ts`) is deliberately NOT
 * exported — see its own doc comment and docs/005.7N-EMBEDDING-MANAGER-REPORT.md —
 * "Architecture" for the naming-collision judgment call.
 */

/* ---- Bootstrap ---- */
export { EmbeddingManagerSystem } from "./bootstrap/embedding-manager-system.js";

/* ---- Config ---- */
export type { EmbeddingManagerConfig } from "./config/embedding-manager-config.js";

/* ---- Context ---- */
export {
  createEmbeddingContext,
  type CreateEmbeddingContextInput,
} from "./context/create-embedding-context.js";
export { type EmbeddingContext } from "./context/embedding-context.js";

/* ---- Domain ---- */
export { EmbeddingRecord } from "./domain/embedding-record.js";
export {
  EmbeddingState,
  EMBEDDING_STATE_TRANSITIONS,
  EMBEDDING_TERMINAL_STATES,
  EMBEDDING_SETTLED_STATES,
} from "./domain/embedding-state.js";
export { EmbeddingSessionState } from "./domain/embedding-session-state.js";
export { EmbeddingProviderType } from "./domain/embedding-provider-type.js";
export { EmbeddingModelName } from "./domain/embedding-model-name.js";
export {
  EMBEDDING_MODEL_PROVIDER_CATALOG,
  isModelCompatibleWithProvider,
} from "./domain/embedding-model-catalog.js";
export { buildProviderRegistryId, buildModelRegistryId } from "./domain/embedding-registry-keys.js";
export { EMPTY_EMBEDDING_STATISTICS } from "./domain/embedding-statistics-snapshot.js";
export type { EmbeddingStatisticsSnapshot } from "./domain/embedding-statistics-snapshot.js";
export type { Embedding } from "./domain/embedding.js";
export type { EmbeddingJob } from "./domain/embedding-job.js";
export type { EmbeddingSessionRecord } from "./domain/embedding-session.js";
export type { EmbeddingRequest } from "./domain/embedding-request.js";
export type { EmbeddingMetadata } from "./domain/embedding-metadata.js";
export type { EmbeddingProvider } from "./domain/embedding-provider.js";
export type { EmbeddingModel } from "./domain/embedding-model.js";
export type { EmbeddingVersion } from "./domain/embedding-version.js";
export type { EmbeddingNamespace } from "./domain/embedding-namespace.js";
export type { EmbeddingCache } from "./domain/embedding-cache.js";
export type { EmbeddingConfiguration } from "./domain/embedding-configuration.js";
export type { EmbeddingResultMetadata } from "./domain/embedding-result-metadata.js";
export type { EmbeddingAudit } from "./domain/embedding-audit.js";
export type { EmbeddingLogEntry } from "./domain/embedding-log-entry.js";
export type { EmbeddingHistoryEntry } from "./domain/embedding-history-entry.js";
export type { EmbeddingExecution } from "./domain/embedding-execution.js";

/* ---- Contracts ---- */
export type { IEmbedding } from "./contracts/i-embedding.js";
export type {
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
} from "./contracts/i-embedding-validator.js";
export type {
  CreateEmbeddingInput,
  EmbeddingTokenInput,
  FailEmbeddingInput,
  OpenEmbeddingSessionInput,
  EmbeddingSessionTokenInput,
  CreateEmbeddingJobInput,
  CreateEmbeddingJobResult,
  EmbeddingJobTokenInput,
  FailEmbeddingJobInput,
  ListEmbeddingsResult,
} from "./contracts/i-embedding-manager-operations.js";
export type {
  IEmbeddingProvider,
  EmbeddingProviderResultInput,
} from "./contracts/i-embedding-provider.js";
export type { IEmbeddingModelProvider } from "./contracts/i-embedding-model-provider.js";
export type { IEmbeddingStorageProvider } from "./contracts/i-embedding-storage-provider.js";
export type { IEmbeddingCacheProvider } from "./contracts/i-embedding-cache-provider.js";
export type { IEmbeddingScheduler } from "./contracts/i-embedding-scheduler.js";
export type { IEmbeddingAuditProvider } from "./contracts/i-embedding-audit-provider.js";
export type { IEmbeddingPublisher } from "./contracts/i-embedding-publisher.js";
export type { IEmbeddingCompressionProvider } from "./contracts/i-embedding-compression-provider.js";
export type { IEmbeddingEncryptionProvider } from "./contracts/i-embedding-encryption-provider.js";
export type { IEmbeddingCostProvider } from "./contracts/i-embedding-cost-provider.js";
export type { IEmbeddingMetricsProvider } from "./contracts/i-embedding-metrics-provider.js";
export type { IEmbeddingStreamingProvider } from "./contracts/i-embedding-streaming-provider.js";
export type { IKnowledgeGraphEmbeddingProvider } from "./contracts/i-knowledge-graph-embedding-provider.js";
export type { IKnowledgeRecommendationEmbeddingProvider } from "./contracts/i-knowledge-recommendation-embedding-provider.js";

/* ---- Errors ---- */
export { EmbeddingManagerException } from "./errors/embedding-manager-exception.js";
export { EmbeddingNotFoundException } from "./errors/embedding-not-found-exception.js";
export { DuplicateEmbeddingEntryException } from "./errors/duplicate-embedding-entry-exception.js";
export { IllegalEmbeddingTransitionException } from "./errors/illegal-embedding-transition-exception.js";
export { InvalidEmbeddingMetadataException } from "./errors/invalid-embedding-metadata-exception.js";
export { EmbeddingCheckException } from "./errors/embedding-check-exception.js";
export { EmbeddingOperationException } from "./errors/embedding-operation-exception.js";
export { EmbeddingConfigurationException } from "./errors/embedding-configuration-exception.js";
export { EmbeddingSessionException } from "./errors/embedding-session-exception.js";
export { EmbeddingProviderException } from "./errors/embedding-provider-exception.js";
export { EmbeddingModelException } from "./errors/embedding-model-exception.js";
export { EmbeddingVersionException } from "./errors/embedding-version-exception.js";
export { EmbeddingNamespaceException } from "./errors/embedding-namespace-exception.js";

/* ---- Events ---- */
export { EmbeddingManagerEventType } from "./events/embedding-manager-event-type.js";
export { EmbeddingEvents } from "./events/embedding-events.js";

/* ---- Factory ---- */
export { EmbeddingFactory } from "./factory/embedding-factory.js";

/* ---- Embedding (Public API façade) ---- */
export { EmbeddingManager } from "./embedding/embedding-manager.js";

/* ---- Health ---- */
export { EmbeddingHealth } from "./health/embedding-health.js";
export type {
  HealthStatus,
  ComponentHealth,
  EmbeddingManagerHealthReport,
} from "./health/i-health-check.js";

/* ---- Lifecycle ---- */
export { EmbeddingLifecycle } from "./lifecycle/embedding-lifecycle.js";

/* ---- Metrics ---- */
export { EmbeddingMetrics } from "./metrics/embedding-metrics.js";
export type {
  IEmbeddingManagerMetricsCollector,
  EmbeddingManagerMetricsSnapshot,
} from "./metrics/i-embedding-manager-metrics-collector.js";

/* ---- Middleware ---- */
export {
  EmbeddingMiddleware,
  type EmbeddingMiddlewareFn,
  type EmbeddingMiddlewareNext,
} from "./middleware/embedding-middleware.js";

/* ---- Monitoring ---- */
export {
  EmbeddingMonitoring,
  type EmbeddingManagerDashboard,
} from "./monitoring/embedding-monitoring.js";

/* ---- Pipeline ---- */
export {
  EmbeddingPipeline,
  type RunEmbeddingPipelineInput,
} from "./pipeline/embedding-pipeline.js";

/* ---- Registry ---- */
export { EmbeddingRegistry } from "./registry/embedding-registry.js";
export { EmbeddingRegistryBucket } from "./registry/embedding-registry-bucket.js";
export type { EmbeddingRegistryEntry } from "./registry/embedding-registry-entry.js";

/* ---- Resolver ---- */
export { EmbeddingResolver } from "./resolver/embedding-resolver.js";

/* ---- Session ---- */
export { EmbeddingSession } from "./session/embedding-session.js";
export type { EmbeddingSessionLedgerRecord } from "./session/embedding-session-record.js";

/* ---- State Machine ---- */
export { EmbeddingStateMachine } from "./state-machine/embedding-state-machine.js";

/* ---- Statistics ---- */
export { EmbeddingStatistics } from "./statistics/embedding-statistics.js";

/* ---- Token ---- */
export {
  generateEmbeddingManagerToken,
  isEmbeddingManagerToken,
} from "./token/embedding-manager-token.js";

/* ---- Validator ---- */
export { EmbeddingValidator } from "./validator/embedding-validator.js";
export { IdentityValidator } from "./validator/identity-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { ProviderValidator } from "./validator/provider-validator.js";
export { ModelValidator } from "./validator/model-validator.js";
export { NamespaceValidator } from "./validator/namespace-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { VersionValidator } from "./validator/version-validator.js";
export { LifecycleValidator } from "./validator/lifecycle-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";
export { StatisticsValidator } from "./validator/statistics-validator.js";
export { IntegrityValidator } from "./validator/integrity-validator.js";
export { AuditValidator } from "./validator/audit-validator.js";
