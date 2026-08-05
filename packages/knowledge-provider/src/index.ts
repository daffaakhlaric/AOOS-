/**
 * "PUBLIC API: KnowledgeProvider, KnowledgeProviderSystem, KnowledgeProviderRegistry,
 * KnowledgeProviderResolver, KnowledgeProviderManager, KnowledgeProviderFactory,
 * KnowledgeProviderContext, KnowledgeProviderSession, KnowledgeProviderValidator,
 * KnowledgeProviderPipeline, KnowledgeProviderLifecycle, KnowledgeProviderStateMachine,
 * KnowledgeProviderMetrics, KnowledgeProviderHealth, KnowledgeProviderMonitor,
 * KnowledgeProviderEvents, KnowledgeProviderStatistics, KnowledgeProviderCapabilities,
 * KnowledgeProviderMetadata, KnowledgeProviderPolicy, KnowledgeProviderConfiguration."
 * (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md). The 21 named exports below, plus the full
 * Domain/Contracts/Errors/Validator-stage/Factory-sub-class surface a caller needs to
 * actually build and use them — matching the curation approach established in
 * `@aos/knowledge-synchronization`/`@aos/knowledge-retrieval`.
 */
export { KnowledgeProvider, type KnowledgeProviderOptions } from "./provider/knowledge-provider.js";

export { KnowledgeProviderSystem } from "./bootstrap/knowledge-provider-system.js";

export { KnowledgeProviderRegistry } from "./registry/knowledge-provider-registry.js";
export { KnowledgeProviderRegistryBucket } from "./registry/knowledge-provider-registry-bucket.js";

export { KnowledgeProviderResolver } from "./resolver/knowledge-provider-resolver.js";

export { KnowledgeProviderManager } from "./manager/knowledge-provider-manager.js";

export { KnowledgeProviderFactory } from "./factory/knowledge-provider-factory.js";
export { ProviderContextFactory } from "./factory/provider-context-factory.js";
export { ProviderSessionFactory } from "./factory/provider-session-factory.js";
export {
  ProviderMetadataFactory,
  type CreateProviderMetadataInput,
} from "./factory/provider-metadata-factory.js";
export { ProviderCapabilityFactory } from "./factory/provider-capability-factory.js";
export { ProviderStatisticsFactory } from "./factory/provider-statistics-factory.js";

export {
  knowledgeProviderContextSchema,
  type KnowledgeProviderContext,
} from "./context/knowledge-provider-context.js";
export {
  createKnowledgeProviderContext,
  type CreateKnowledgeProviderContextInput,
} from "./context/create-knowledge-provider-context.js";

export { KnowledgeProviderSession } from "./session/knowledge-provider-session.js";
export { KnowledgeProviderSessionState } from "./session/knowledge-provider-session-state.js";
export type { KnowledgeProviderSessionRecord } from "./session/knowledge-provider-session-record.js";

export { KnowledgeProviderValidator } from "./validator/knowledge-provider-validator.js";
export { ProviderIdValidator } from "./validator/provider-id-validator.js";
export { ProviderNameValidator } from "./validator/provider-name-validator.js";
export { ProviderVersionValidator } from "./validator/provider-version-validator.js";
export { CategoryValidator } from "./validator/category-validator.js";
export { CapabilitiesValidator } from "./validator/capabilities-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { TenantValidator } from "./validator/tenant-validator.js";
export { ExecutionTokenValidator } from "./validator/execution-token-validator.js";

export {
  KnowledgeProviderPipeline,
  type KnowledgeProviderPipelineOptions,
  type RunProviderPipelineInput,
  type RunProviderPipelineOutput,
} from "./pipeline/knowledge-provider-pipeline.js";

export { KnowledgeProviderLifecycle } from "./lifecycle/knowledge-provider-lifecycle.js";

export { KnowledgeProviderStateMachine } from "./state-machine/knowledge-provider-state-machine.js";
export type {
  IKnowledgeProviderStateMachine,
  KnowledgeProviderStateTransitionInput,
} from "./state-machine/i-state-machine.js";

export { KnowledgeProviderMetrics } from "./metrics/knowledge-provider-metrics.js";
export type {
  IKnowledgeProviderMetricsCollector,
  KnowledgeProviderMetricsSnapshot,
} from "./metrics/i-knowledge-provider-metrics.js";

export { KnowledgeProviderHealth } from "./health/knowledge-provider-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeProviderHealthReport,
} from "./health/i-health-check.js";

export { KnowledgeProviderMonitor } from "./monitoring/knowledge-provider-monitor.js";
export type { KnowledgeProviderDashboard } from "./monitoring/knowledge-provider-monitor.js";

export { KnowledgeProviderEvents } from "./events/knowledge-provider-events.js";
export { KnowledgeProviderEventType } from "./events/knowledge-provider-event-type.js";

export { KnowledgeProviderStatistics } from "./statistics/knowledge-provider-statistics.js";

export { KnowledgeProviderCapabilities } from "./capabilities/knowledge-provider-capabilities.js";

export { KnowledgeProviderMetadata } from "./metadata/knowledge-provider-metadata.js";

export { KnowledgeProviderPolicy } from "./policy/knowledge-provider-policy.js";
export {
  knowledgeProviderPolicyRecordSchema,
  type KnowledgeProviderPolicyRecord,
  type KnowledgeProviderPolicyViolation,
} from "./policy/knowledge-provider-policy-record.js";

export { KnowledgeProviderConfiguration } from "./configuration/knowledge-provider-configuration.js";

export type { IProviderPermissionChecker } from "./permission/i-provider-permission-checker.js";

export {
  KnowledgeProviderMiddlewarePipeline,
  type ProviderMiddleware,
  type ProviderMiddlewareNext,
} from "./middleware/knowledge-provider-middleware.js";

export { BUILT_IN_PROVIDER_DEFINITIONS } from "./definitions/built-in-provider-definitions.js";
export type { KnowledgeProviderDefinition } from "./definitions/knowledge-provider-definition.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";
export {
  generateKnowledgeProviderToken,
  isKnowledgeProviderToken,
  type KnowledgeProviderToken,
} from "./token/knowledge-provider-token.js";

export type { KnowledgeProviderConfig } from "./config/knowledge-provider-config.js";
