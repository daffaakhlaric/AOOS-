/**
 * "PUBLIC API: KnowledgeSourceManager, KnowledgeSourceManagerSystem, KnowledgeSource,
 * KnowledgeSourceRegistry, KnowledgeSourceResolver, KnowledgeSourceFactory,
 * KnowledgeSourceContext, KnowledgeSourceSession, KnowledgeSourceValidator,
 * KnowledgeSourcePipeline, KnowledgeSourceLifecycle, KnowledgeSourceStateMachine,
 * KnowledgeSourceMetrics, KnowledgeSourceHealth, KnowledgeSourceMonitor,
 * KnowledgeSourceEvents, KnowledgeSourceStatistics, KnowledgeSourceConfiguration,
 * KnowledgeSourcePolicy, KnowledgeSourcePermission, KnowledgeSourceScheduler,
 * KnowledgeSourceCatalog." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md). The 22
 * named exports below, plus the full Domain/Contracts/Errors/Validator-stage/
 * Factory-sub-class surface a caller needs to actually build and use them — matching the
 * curation approach established by `@aos/knowledge-provider`/`@aos/knowledge-synchronization`.
 */
export {
  KnowledgeSourceManager,
  type KnowledgeSourceManagerOptions,
} from "./manager/knowledge-source-manager.js";

export { KnowledgeSourceManagerSystem } from "./bootstrap/knowledge-source-manager-system.js";

export { KnowledgeSource } from "./source/knowledge-source.js";

export { KnowledgeSourceRegistry } from "./registry/knowledge-source-registry.js";
export { KnowledgeSourceRegistryBucket } from "./registry/knowledge-source-registry-bucket.js";
export type { SourceRegistryEntry } from "./registry/source-registry-entry.js";

export { KnowledgeSourceResolver } from "./resolver/knowledge-source-resolver.js";

export { KnowledgeSourceFactory } from "./factory/knowledge-source-factory.js";
export { KnowledgeSourceContextFactory } from "./factory/knowledge-source-context-factory.js";
export { KnowledgeSourceSessionFactory } from "./factory/knowledge-source-session-factory.js";
export {
  KnowledgeSourceMetadataFactory,
  type CreateKnowledgeSourceMetadataInput,
} from "./factory/knowledge-source-metadata-factory.js";
export {
  KnowledgeSourceConfigurationFactory,
  type CreateKnowledgeSourceConfigurationInput,
} from "./factory/knowledge-source-configuration-factory.js";
export { KnowledgeSourceStatisticsFactory } from "./factory/knowledge-source-statistics-factory.js";

export {
  knowledgeSourceContextSchema,
  type KnowledgeSourceContext,
} from "./context/knowledge-source-context.js";
export {
  createKnowledgeSourceContext,
  type CreateKnowledgeSourceContextInput,
} from "./context/create-knowledge-source-context.js";

export { KnowledgeSourceSession } from "./session/knowledge-source-session.js";
export { KnowledgeSourceSessionState } from "./session/knowledge-source-session-state.js";
export type { KnowledgeSourceSessionRecord } from "./session/knowledge-source-session-record.js";

export { KnowledgeSourceValidator } from "./validator/knowledge-source-validator.js";
export { SourceIdValidator } from "./validator/source-id-validator.js";
export { SourceNameValidator } from "./validator/source-name-validator.js";
export { ProviderReferenceValidator } from "./validator/provider-reference-validator.js";
export { CategoryValidator } from "./validator/category-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { TenantValidator } from "./validator/tenant-validator.js";
export { ExecutionTokenValidator } from "./validator/execution-token-validator.js";

export {
  KnowledgeSourcePipeline,
  type KnowledgeSourcePipelineOptions,
  type RunSourcePipelineInput,
  type RunSourcePipelineOutput,
} from "./pipeline/knowledge-source-pipeline.js";

export { KnowledgeSourceLifecycle } from "./lifecycle/knowledge-source-lifecycle.js";

export { KnowledgeSourceStateMachine } from "./state-machine/knowledge-source-state-machine.js";
export type {
  IKnowledgeSourceStateMachine,
  KnowledgeSourceStateTransitionInput,
} from "./state-machine/i-state-machine.js";

export { KnowledgeSourceMetrics } from "./metrics/knowledge-source-metrics.js";
export type {
  IKnowledgeSourceMetricsCollector,
  KnowledgeSourceMetricsSnapshot,
} from "./metrics/i-knowledge-source-metrics-collector.js";

export { KnowledgeSourceHealth } from "./health/knowledge-source-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeSourceHealthReport,
} from "./health/i-health-check.js";

export { KnowledgeSourceMonitor } from "./monitoring/knowledge-source-monitor.js";
export type { KnowledgeSourceDashboard } from "./monitoring/knowledge-source-monitor.js";

export { KnowledgeSourceEvents } from "./events/knowledge-source-events.js";
export { KnowledgeSourceEventType } from "./events/knowledge-source-event-type.js";

export { KnowledgeSourceStatistics } from "./statistics/knowledge-source-statistics.js";

export { KnowledgeSourceConfiguration } from "./configuration/knowledge-source-configuration.js";
export {
  knowledgeSourceConfigurationRecordSchema,
  type KnowledgeSourceConfigurationRecord,
} from "./configuration/knowledge-source-configuration-record.js";

export { KnowledgeSourcePolicy } from "./policy/knowledge-source-policy.js";
export {
  knowledgeSourcePolicyRecordSchema,
  type KnowledgeSourcePolicyRecord,
  type KnowledgeSourcePolicyViolation,
} from "./policy/knowledge-source-policy-record.js";

export { KnowledgeSourcePermission } from "./permission/knowledge-source-permission.js";
export {
  knowledgeSourcePermissionGrantSchema,
  type KnowledgeSourcePermissionGrant,
} from "./permission/knowledge-source-permission-grant.js";

export { KnowledgeSourceScheduler } from "./scheduler/knowledge-source-scheduler.js";
export { KnowledgeSourceScheduleMode } from "./scheduler/knowledge-source-schedule-mode.js";
export {
  knowledgeSourceScheduleDescriptorSchema,
  type KnowledgeSourceScheduleDescriptor,
} from "./scheduler/knowledge-source-schedule-descriptor.js";

export { KnowledgeSourceCatalog } from "./catalog/knowledge-source-catalog.js";

export {
  KnowledgeSourceMiddlewarePipeline,
  type SourceMiddleware,
  type SourceMiddlewareNext,
} from "./middleware/knowledge-source-middleware.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";
export {
  generateKnowledgeSourceToken,
  isKnowledgeSourceToken,
  type KnowledgeSourceToken,
} from "./token/knowledge-source-token.js";

export type { KnowledgeSourceManagerConfig } from "./config/knowledge-source-manager-config.js";
