/**
 * "PUBLIC API: WorkflowIntegration, WorkflowIntegrationSystem, WorkflowIntegrationRegistry,
 * WorkflowIntegrationContext, WorkflowIntegrationPipeline, WorkflowIntegrationMiddleware,
 * WorkflowIntegrationResolver, WorkflowIntegrationValidator, WorkflowIntegrationMetrics,
 * WorkflowIntegrationHealth." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). Unlike
 * `@aos/workflow-execution`'s "Export ONLY" restriction, this prompt does not ask this
 * package to hide every other concrete class — so alongside the 10 named exports above,
 * this barrel also re-exports the full Contracts/Adapter/Future/Events/Errors surface a
 * caller needs to actually configure and use them (Adapters to register, Contracts to
 * implement, Events to subscribe to, Errors to catch).
 */
export { WorkflowIntegration } from "./integration/workflow-integration.js";
export type { WorkflowIntegrationOptions } from "./integration/workflow-integration.js";

export { WorkflowIntegrationSystem } from "./bootstrap/workflow-integration-system.js";

export { WorkflowIntegrationRegistry } from "./registry/workflow-integration-registry.js";
export type { ResolveAdapterOptions } from "./registry/workflow-integration-registry.js";
export type { AdapterRegistration } from "./registry/adapter-registration.js";

export {
  createWorkflowIntegrationContext,
  type CreateWorkflowIntegrationContextInput,
} from "./context/create-workflow-integration-context.js";
export { withIntegrationResult } from "./context/with-integration-result.js";
export {
  workflowIntegrationContextSchema,
  type WorkflowIntegrationContext,
} from "./context/workflow-integration-context.js";
export {
  integrationResultSlotSchema,
  type IntegrationResultSlot,
} from "./context/integration-result-slot.js";

export { WorkflowIntegrationPipeline } from "./pipeline/workflow-integration-pipeline.js";
export type {
  WorkflowIntegrationPipelineOptions,
  IntegrateOutcome,
} from "./pipeline/workflow-integration-pipeline.js";
export { AdapterExecutionMiddleware } from "./pipeline/adapter-execution-middleware.js";

export { WorkflowIntegrationMiddleware } from "./middleware/workflow-integration-middleware.js";
export type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./middleware/i-workflow-integration-middleware.js";
export type { WorkflowIntegrationMiddlewareContext } from "./middleware/workflow-integration-middleware-context.js";
export type { IWorkflowIntegrationPermissionChecker } from "./middleware/i-workflow-integration-permission-checker.js";
export type { AuditEntry, IAuditSink } from "./middleware/i-audit-sink.js";
export { ValidationMiddleware } from "./middleware/validation-middleware.js";
export { PermissionMiddleware } from "./middleware/permission-middleware.js";
export { TracingMiddleware } from "./middleware/tracing-middleware.js";
export { MetricsMiddleware } from "./middleware/metrics-middleware.js";
export { TenantMiddleware } from "./middleware/tenant-middleware.js";
export { EnvironmentMiddleware } from "./middleware/environment-middleware.js";
export { RetryMiddleware } from "./middleware/retry-middleware.js";
export { TimeoutMiddleware } from "./middleware/timeout-middleware.js";
export { LoggingMiddleware } from "./middleware/logging-middleware.js";
export { AuditMiddleware } from "./middleware/audit-middleware.js";

export { WorkflowIntegrationResolver } from "./resolver/workflow-integration-resolver.js";
export type { IWorkflowIntegrationResolver } from "./resolver/i-workflow-integration-resolver.js";

export { WorkflowIntegrationValidator } from "./validator/workflow-integration-validator.js";
export type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationIssue,
  IntegrationValidationResult,
} from "./validator/i-workflow-integration-validator.js";
export { DuplicateAdapterValidator } from "./validator/duplicate-adapter-validator.js";
export { NamespaceValidator } from "./validator/namespace-validator.js";
export { VersionValidator } from "./validator/version-validator.js";
export { CircularIntegrationValidator } from "./validator/circular-integration-validator.js";
export { MissingRuntimeValidator } from "./validator/missing-runtime-validator.js";
export { TenantValidator } from "./validator/tenant-validator.js";
export { EnvironmentValidator } from "./validator/environment-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";

export { WorkflowIntegrationMetrics } from "./metrics/workflow-integration-metrics.js";
export type {
  IWorkflowIntegrationMetrics,
  WorkflowIntegrationMetricsSnapshot,
} from "./metrics/i-workflow-integration-metrics.js";

export { WorkflowIntegrationHealth } from "./health/workflow-integration-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  WorkflowIntegrationHealthReport,
} from "./health/i-health-check.js";

export { WorkflowIntegrationMonitor } from "./monitoring/workflow-integration-monitor.js";
export type { IntegrationDashboard } from "./monitoring/workflow-integration-monitor.js";

export { WorkflowIntegrationEventPublisher } from "./events/workflow-integration-event-publisher.js";
export { WorkflowIntegrationEventType } from "./events/workflow-integration-event-type.js";

export * from "./adapter/index.js";
export * from "./contracts/index.js";
export * from "./future/index.js";
export * from "./errors/index.js";

export { RetryCoordinator } from "./retry/retry-coordinator.js";
export { RetryStrategy, type RetryPolicy } from "./retry/retry-policy.js";
export type { RetryMetadata, RetryState } from "./retry/retry-state.js";

export type { WorkflowIntegrationConfig } from "./config/workflow-integration-config.js";
