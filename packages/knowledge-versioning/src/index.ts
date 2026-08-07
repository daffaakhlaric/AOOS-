/**
 * "PUBLIC API: KnowledgeVersioning, KnowledgeVersion, KnowledgeVersionManager,
 * KnowledgeVersionRegistry, KnowledgeVersionResolver, KnowledgeVersionValidator,
 * KnowledgeVersionPipeline, KnowledgeVersionMiddleware, KnowledgeVersionFactory,
 * KnowledgeVersionContext, KnowledgeVersionSession, KnowledgeVersionLifecycle,
 * KnowledgeVersionStateMachine, KnowledgeVersionEvents, KnowledgeVersionMetrics,
 * KnowledgeVersionHealth, KnowledgeVersionMonitoring, KnowledgeVersionStatistics,
 * KnowledgeVersionSystem." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the 18 named
 * exports below, plus the full Domain/Contracts/Errors/Validator-stage surface a caller
 * needs to actually build and use them — matching the curation approach established by
 * `@aos/knowledge-source-manager`/`@aos/knowledge-provider`.
 */
export {
  KnowledgeVersioning,
  type KnowledgeVersioningOptions,
} from "./versioning/knowledge-versioning.js";

export { KnowledgeVersionManager } from "./manager/knowledge-version-manager.js";

export { KnowledgeVersionRegistry } from "./registry/knowledge-version-registry.js";
export { KnowledgeVersionRegistryBucket } from "./registry/knowledge-version-registry-bucket.js";
export type { VersionRegistryEntry } from "./registry/version-registry-entry.js";

export { KnowledgeVersionResolver } from "./resolver/knowledge-version-resolver.js";

export { KnowledgeVersionValidator } from "./validator/knowledge-version-validator.js";
export { IdentityValidator } from "./validator/identity-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { VersionNumberValidator } from "./validator/version-number-validator.js";
export { LifecycleValidator } from "./validator/lifecycle-validator.js";
export { BranchValidator } from "./validator/branch-validator.js";
export { PolicyValidator } from "./validator/policy-validator.js";
export { PermissionValidator } from "./validator/permission-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";
export { IntegrityValidator } from "./validator/integrity-validator.js";

export {
  KnowledgeVersionPipeline,
  type RunVersionPipelineInput,
} from "./pipeline/knowledge-version-pipeline.js";

export {
  KnowledgeVersionMiddleware,
  type VersionMiddleware,
  type VersionMiddlewareNext,
} from "./middleware/knowledge-version-middleware.js";

export { KnowledgeVersionFactory } from "./factory/knowledge-version-factory.js";
export {
  KnowledgeVersionVersionFactory,
  type CreateKnowledgeVersionMetadataInput,
} from "./factory/knowledge-version-version-factory.js";
export {
  KnowledgeVersionSnapshotFactory,
  type CreateKnowledgeSnapshotInput,
} from "./factory/knowledge-version-snapshot-factory.js";
export {
  KnowledgeVersionBranchFactory,
  type CreateKnowledgeBranchInput,
} from "./factory/knowledge-version-branch-factory.js";
export { KnowledgeVersionHistoryFactory } from "./factory/knowledge-version-history-factory.js";
export {
  KnowledgeVersionMetadataFactory,
  type UpdateKnowledgeVersionMetadataInput,
} from "./factory/knowledge-version-metadata-factory.js";
export {
  KnowledgeVersionConfigurationFactory,
  type CreateKnowledgeVersionConfigurationInput,
} from "./factory/knowledge-version-configuration-factory.js";

export {
  knowledgeVersionContextSchema,
  type KnowledgeVersionContext,
} from "./context/knowledge-version-context.js";
export {
  createKnowledgeVersionContext,
  type CreateKnowledgeVersionContextInput,
} from "./context/create-knowledge-version-context.js";

export { KnowledgeVersionSession } from "./session/knowledge-version-session.js";
export { KnowledgeVersionSessionState } from "./session/knowledge-version-session-state.js";
export type { KnowledgeVersionSessionRecord } from "./session/knowledge-version-session-record.js";

export { KnowledgeVersionLifecycle } from "./lifecycle/knowledge-version-lifecycle.js";

export { KnowledgeVersionStateMachine } from "./state-machine/knowledge-version-state-machine.js";
export type {
  IKnowledgeVersionStateMachine,
  KnowledgeVersionStateTransitionInput,
} from "./state-machine/i-state-machine.js";

export { KnowledgeVersionEvents } from "./events/knowledge-version-events.js";
export { KnowledgeVersionEventType } from "./events/knowledge-version-event-type.js";

export { KnowledgeVersionMetrics } from "./metrics/knowledge-version-metrics.js";
export type {
  IKnowledgeVersionMetricsCollector,
  KnowledgeVersionMetricsSnapshot,
} from "./metrics/i-knowledge-version-metrics-collector.js";

export { KnowledgeVersionHealth } from "./health/knowledge-version-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeVersionHealthReport,
} from "./health/i-health-check.js";

export {
  KnowledgeVersionMonitoring,
  type KnowledgeVersionDashboard,
} from "./monitoring/knowledge-version-monitoring.js";

export { KnowledgeVersionStatistics } from "./statistics/knowledge-version-statistics.js";

export { KnowledgeVersionConfiguration } from "./configuration/knowledge-version-configuration.js";
export {
  knowledgeVersionConfigurationRecordSchema,
  type KnowledgeVersionConfigurationRecord,
} from "./configuration/knowledge-version-configuration-record.js";

export { KnowledgeVersionPolicy } from "./policy/knowledge-version-policy.js";
export {
  knowledgeVersionPolicyRecordSchema,
  type KnowledgeVersionPolicyRecord,
  type KnowledgeVersionPolicyViolation,
} from "./policy/knowledge-version-policy-record.js";

export { KnowledgeVersionPermission } from "./permission/knowledge-version-permission.js";
export {
  knowledgeVersionPermissionGrantSchema,
  type KnowledgeVersionPermissionGrant,
} from "./permission/knowledge-version-permission-grant.js";

export { KnowledgeVersionSystem } from "./bootstrap/knowledge-version-system.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";
export {
  generateKnowledgeVersionToken,
  isKnowledgeVersionToken,
  type KnowledgeVersionToken,
} from "./token/knowledge-version-token.js";

export type { KnowledgeVersioningConfig } from "./config/knowledge-versioning-config.js";
