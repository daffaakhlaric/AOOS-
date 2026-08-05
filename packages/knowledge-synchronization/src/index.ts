/**
 * "PUBLIC API: KnowledgeSynchronization, KnowledgeSynchronizationSystem,
 * KnowledgeSynchronizationManager, KnowledgeSynchronizationJob,
 * KnowledgeSynchronizationSession, KnowledgeSynchronizationContext,
 * KnowledgeSynchronizationRegistry, KnowledgeSynchronizationResolver,
 * KnowledgeSynchronizationPipeline, KnowledgeSynchronizationValidator,
 * KnowledgeSynchronizationScheduler, KnowledgeSynchronizationEvents,
 * KnowledgeSynchronizationMetrics, KnowledgeSynchronizationHealth,
 * KnowledgeSynchronizationMonitor, KnowledgeSynchronizationFactory,
 * KnowledgeSynchronizationStatistics, KnowledgeSynchronizationStateMachine,
 * KnowledgeSynchronizationLifecycle, KnowledgeSynchronizationPolicy."
 * (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md). The 20 named exports below, plus the
 * full Domain/Contracts/Errors/Validator-stage/Factory-sub-class surface a caller needs
 * to actually build and use them — matching the curation approach established in
 * `@aos/knowledge-engine`/`@aos/knowledge-runtime`/`@aos/knowledge-indexing`/
 * `@aos/knowledge-retrieval`.
 */
export {
  KnowledgeSynchronization,
  type KnowledgeSynchronizationOptions,
} from "./synchronization/knowledge-synchronization.js";

export { KnowledgeSynchronizationSystem } from "./bootstrap/knowledge-synchronization-system.js";

export { KnowledgeSynchronizationManager } from "./manager/knowledge-synchronization-manager.js";

export {
  KnowledgeSynchronizer,
  type SynchronizeInput,
} from "./synchronizer/knowledge-synchronizer.js";

export {
  knowledgeSynchronizationContextSchema,
  type KnowledgeSynchronizationContext,
} from "./context/knowledge-synchronization-context.js";
export {
  createKnowledgeSynchronizationContext,
  type CreateKnowledgeSynchronizationContextInput,
} from "./context/create-knowledge-synchronization-context.js";

export { KnowledgeSynchronizationSession } from "./session/knowledge-synchronization-session.js";
export { KnowledgeSynchronizationSessionState } from "./session/knowledge-synchronization-session-state.js";
export type { KnowledgeSynchronizationSessionRecord } from "./session/knowledge-synchronization-session-record.js";

export { KnowledgeSynchronizationRegistry } from "./registry/knowledge-synchronization-registry.js";
export { KnowledgeSynchronizationRegistryBucket } from "./registry/knowledge-synchronization-registry-bucket.js";

export { KnowledgeSynchronizationResolver } from "./resolver/knowledge-synchronization-resolver.js";

export {
  KnowledgeSynchronizationPipeline,
  type KnowledgeSynchronizationPipelineOptions,
  type RunSynchronizationInput,
  type RunSynchronizationOutput,
} from "./pipeline/knowledge-synchronization-pipeline.js";

export { KnowledgeSynchronizationValidator } from "./validator/knowledge-synchronization-validator.js";
export type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationIssue,
  KnowledgeSynchronizationValidationResult,
} from "./validator/i-knowledge-synchronization-validator.js";
export { ProviderValidator } from "./validator/provider-validator.js";
export { SourceValidator } from "./validator/source-validator.js";
export { NamespaceValidator } from "./validator/namespace-validator.js";
export { PolicyValidator } from "./validator/policy-validator.js";
export { PermissionValidator } from "./validator/permission-validator.js";
export { ScheduleValidator } from "./validator/schedule-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { RelationshipValidator } from "./validator/relationship-validator.js";
export { VersionValidator } from "./validator/version-validator.js";
export { TenantValidator } from "./validator/tenant-validator.js";
export { WorkspaceValidator } from "./validator/workspace-validator.js";
export { ExecutionTokenValidator } from "./validator/execution-token-validator.js";

export {
  KnowledgeSynchronizationScheduler,
  type ScheduleInput,
} from "./scheduler/knowledge-synchronization-scheduler.js";
export {
  knowledgeSynchronizationScheduleEntrySchema,
  knowledgeSynchronizationScheduleStatusSchema,
  type KnowledgeSynchronizationScheduleEntry,
  type KnowledgeSynchronizationScheduleStatus,
} from "./scheduler/knowledge-synchronization-schedule-entry.js";

export { KnowledgeSynchronizationEvents } from "./events/knowledge-synchronization-events.js";
export { KnowledgeSynchronizationEventType } from "./events/knowledge-synchronization-event-type.js";

export { KnowledgeSynchronizationMetrics } from "./metrics/knowledge-synchronization-metrics.js";
export type {
  IKnowledgeSynchronizationMetrics,
  KnowledgeSynchronizationMetricsSnapshot,
} from "./metrics/i-knowledge-synchronization-metrics.js";

export { KnowledgeSynchronizationHealth } from "./health/knowledge-synchronization-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeSynchronizationHealthReport,
} from "./health/i-health-check.js";

export { KnowledgeSynchronizationMonitor } from "./monitoring/knowledge-synchronization-monitor.js";
export type { KnowledgeSynchronizationDashboard } from "./monitoring/knowledge-synchronization-monitor.js";

export { KnowledgeSynchronizationFactory } from "./factory/knowledge-synchronization-factory.js";
export {
  SynchronizationJobFactory,
  type CreateSynchronizationJobInput,
} from "./factory/synchronization-job-factory.js";
export { SynchronizationContextFactory } from "./factory/synchronization-context-factory.js";
export { SynchronizationSessionFactory } from "./factory/synchronization-session-factory.js";
export {
  SynchronizationPolicyFactory,
  type CreateSynchronizationPolicyInput,
} from "./factory/synchronization-policy-factory.js";
export { SynchronizationStatisticsFactory } from "./factory/synchronization-statistics-factory.js";

export { KnowledgeSynchronizationStatistics } from "./statistics/knowledge-synchronization-statistics.js";

export { KnowledgeSynchronizationStateMachine } from "./state-machine/knowledge-synchronization-state-machine.js";
export type {
  IKnowledgeSynchronizationStateMachine,
  KnowledgeSynchronizationStateTransitionInput,
} from "./state-machine/i-state-machine.js";

export { KnowledgeSynchronizationLifecycle } from "./lifecycle/knowledge-synchronization-lifecycle.js";

export { KnowledgeSynchronizationPolicy } from "./policy/knowledge-synchronization-policy.js";
export {
  knowledgeSynchronizationPolicyRecordSchema,
  type KnowledgeSynchronizationPolicyRecord,
  type KnowledgeSynchronizationPolicyViolation,
} from "./policy/knowledge-synchronization-policy-record.js";

export type { ISynchronizationPermissionChecker } from "./permission/i-synchronization-permission-checker.js";

export {
  KnowledgeSynchronizationMiddlewarePipeline,
  type SynchronizationMiddleware,
  type SynchronizationMiddlewareNext,
} from "./middleware/knowledge-synchronization-middleware.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";
export {
  generateKnowledgeSynchronizationToken,
  isKnowledgeSynchronizationToken,
  type KnowledgeSynchronizationToken,
} from "./token/knowledge-synchronization-token.js";

export type { KnowledgeSynchronizationConfig } from "./config/knowledge-synchronization-config.js";
