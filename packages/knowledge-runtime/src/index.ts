/**
 * "PUBLIC API: KnowledgeRuntime, KnowledgeRuntimeSystem, KnowledgeRuntimeContext,
 * KnowledgeRuntimeInstance, KnowledgeRuntimeSession, KnowledgeRuntimeManager,
 * KnowledgeRuntimeRegistry, KnowledgeRuntimeResolver, KnowledgeRuntimeLoader,
 * KnowledgeRuntimeValidator, KnowledgeRuntimeStateMachine, KnowledgeRuntimeLifecycle,
 * KnowledgeRuntimeMiddleware, KnowledgeRuntimeEvents, KnowledgeRuntimeMetrics,
 * KnowledgeRuntimeHealth, KnowledgeRuntimeMonitor, KnowledgeRuntimeFactory."
 * (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md). The 18 named exports below, plus the full
 * Domain/Contracts/Errors/Session/Token/Snapshot/Factory-sub-class/Validator-stage/
 * Middleware-stage surface a caller needs to actually build and use them — matching the
 * curation approach established in `@aos/knowledge-engine`/`@aos/workflow-integration`.
 */
export { KnowledgeRuntime, type KnowledgeRuntimeOptions } from "./runtime/knowledge-runtime.js";

export { KnowledgeRuntimeSystem } from "./bootstrap/knowledge-runtime-system.js";

export {
  knowledgeRuntimeContextSchema,
  type KnowledgeRuntimeContext,
} from "./context/knowledge-runtime-context.js";
export {
  createKnowledgeRuntimeContext,
  type CreateKnowledgeRuntimeContextInput,
} from "./context/create-knowledge-runtime-context.js";

export { KnowledgeRuntimeSession } from "./session/knowledge-runtime-session.js";
export { KnowledgeRuntimeSessionState } from "./session/knowledge-runtime-session-state.js";
export type { KnowledgeRuntimeSessionRecord } from "./session/knowledge-runtime-session-record.js";

export { KnowledgeRuntimeManager } from "./manager/knowledge-runtime-manager.js";

export { KnowledgeRuntimeRegistry } from "./registry/knowledge-runtime-registry.js";

export { KnowledgeRuntimeResolver } from "./resolver/knowledge-runtime-resolver.js";

export { KnowledgeRuntimeLoader } from "./loader/knowledge-runtime-loader.js";
export type { IKnowledgeRuntimeLoader } from "./loader/i-knowledge-runtime-loader.js";

export { KnowledgeRuntimeValidator } from "./validator/knowledge-runtime-validator.js";
export type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationIssue,
  KnowledgeRuntimeValidationResult,
} from "./validator/i-knowledge-runtime-validator.js";
export { RuntimeStateValidator } from "./validator/runtime-state-validator.js";
export { ContextValidator } from "./validator/context-validator.js";
export { RuntimePermissionValidator } from "./validator/runtime-permission-validator.js";
export { RuntimePolicyValidator } from "./validator/runtime-policy-validator.js";
export { RuntimeLifecycleValidator } from "./validator/runtime-lifecycle-validator.js";
export { RuntimeRelationshipValidator } from "./validator/runtime-relationship-validator.js";
export { RuntimeNamespaceValidator } from "./validator/runtime-namespace-validator.js";
export { RuntimeMetadataValidator } from "./validator/runtime-metadata-validator.js";
export { RuntimeTenantValidator } from "./validator/runtime-tenant-validator.js";
export { RuntimeWorkspaceValidator } from "./validator/runtime-workspace-validator.js";
export { ExecutionTokenValidator } from "./validator/execution-token-validator.js";

export { KnowledgeRuntimeStateMachine } from "./state-machine/knowledge-runtime-state-machine.js";
export type {
  IKnowledgeRuntimeStateMachine,
  KnowledgeRuntimeStateTransitionInput,
} from "./state-machine/i-state-machine.js";

export { KnowledgeRuntimeLifecycle } from "./lifecycle/knowledge-runtime-lifecycle.js";
export type { IKnowledgeRuntimeLifecycle } from "./lifecycle/i-lifecycle.js";

export { KnowledgeRuntimeMiddleware } from "./middleware/knowledge-runtime-middleware.js";
export type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./middleware/i-runtime-middleware.js";
export type { IKnowledgeRuntimePermissionChecker } from "./middleware/i-permission-checker.js";
export type { IKnowledgeRuntimePolicyChecker } from "./middleware/i-policy-checker.js";
export {
  ConsoleKnowledgeRuntimeLogger,
  type IKnowledgeRuntimeLogger,
} from "./middleware/i-runtime-logger.js";
export { ValidationMiddleware } from "./middleware/validation-middleware.js";
export { ContextMiddleware } from "./middleware/context-middleware.js";
export { PermissionMiddleware } from "./middleware/permission-middleware.js";
export { PolicyMiddleware } from "./middleware/policy-middleware.js";
export { TracingMiddleware } from "./middleware/tracing-middleware.js";
export { MetricsMiddleware } from "./middleware/metrics-middleware.js";
export { LifecycleMiddleware, type LifecycleOperation } from "./middleware/lifecycle-middleware.js";
export { LoggingMiddleware } from "./middleware/logging-middleware.js";

export { KnowledgeRuntimeEvents } from "./events/knowledge-runtime-events.js";
export { KnowledgeRuntimeEventType } from "./events/knowledge-runtime-event-type.js";

export { KnowledgeRuntimeMetrics } from "./metrics/knowledge-runtime-metrics.js";
export type {
  IKnowledgeRuntimeMetrics,
  KnowledgeRuntimeMetricsSnapshot,
} from "./metrics/i-knowledge-runtime-metrics.js";

export { KnowledgeRuntimeHealth } from "./health/knowledge-runtime-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeRuntimeHealthReport,
} from "./health/i-health-check.js";

export { KnowledgeRuntimeMonitor } from "./monitoring/knowledge-runtime-monitor.js";
export type { KnowledgeRuntimeDashboard } from "./monitoring/knowledge-runtime-monitor.js";

export { KnowledgeRuntimeFactory } from "./factory/knowledge-runtime-factory.js";
export type { CreateKnowledgeRuntimeExecutionInput } from "./factory/knowledge-runtime-factory.js";
export { RuntimeContextFactory } from "./factory/runtime-context-factory.js";
export { RuntimeSessionFactory } from "./factory/runtime-session-factory.js";
export { RuntimeSnapshotFactory } from "./factory/runtime-snapshot-factory.js";
export {
  RuntimeMetadataFactory,
  type CreateRuntimeMetadataInput,
} from "./factory/runtime-metadata-factory.js";
export { RuntimeTokenFactory } from "./factory/runtime-token-factory.js";

export { SnapshotManager } from "./snapshot/snapshot-manager.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";
export * from "./token/index.js";

export type { KnowledgeRuntimeConfig } from "./config/knowledge-runtime-config.js";
