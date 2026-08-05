/**
 * "PUBLIC API: Export ONLY WorkflowExecutionEngine, ExecutionToken, ExecutionContext,
 * ExecutionResult, ExecutionState, Interfaces. Hide all internal services."
 * (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). `WorkflowExecutionEngine` (and its
 * Kernel Module wrapper `WorkflowExecutionSystem`) are the only *stateful service* classes
 * this package exports — every concrete internal implementation (the Validation/
 * Transition/Retry/Metrics/Health/Monitoring concrete classes, every concrete Middleware,
 * the `ExecutionStateMachine`, the in-memory `ExecutionCoordinator`) stays unexported.
 * What remains exported below is: (a) pure, stateless data/factory functions (Token/
 * Context/Cursor/Result/Graph construction — analogous to `@aos/node-runtime`'s
 * `createNodeInstance` et al.), (b) the interface-only extension points (Capability/
 * Checkpoint/Compensation/Middleware/Validator/Metrics/Health/Monitoring contracts), and
 * (c) `ExecutionEventPublisher`, a concrete class exported only because it is a *required
 * constructor argument* for `WorkflowExecutionEngine` — an unavoidable minimum for a
 * usable TypeScript public API, not a loophole around the directive above.
 */
export { WorkflowExecutionEngine } from "./engine/workflow-execution-engine.js";
export type { WorkflowExecutionEngineOptions } from "./engine/workflow-execution-engine.js";
export type { ExecuteWorkflowInput } from "./engine/execute-workflow-input.js";
export type { ExecutionSession } from "./engine/execution-session.js";
export { WorkflowExecutionSystem } from "./bootstrap/workflow-execution-system.js";

// Token / Context / Cursor / Result / Graph — pure data contracts and factory functions.
export * from "./token/index.js";
export * from "./context/index.js";
export * from "./cursor/index.js";
export * from "./result/index.js";
export * from "./graph/index.js";

// State Machine — the enum + authoritative transition table (pure data, no service class exported).
export * from "./state-machine/execution-state.js";

// Retry — Policy/State/Metadata contracts (the stateful `RetryCoordinator` stays internal).
export * from "./retry/retry-policy.js";
export * from "./retry/retry-state.js";

// Interface-only extension points.
export * from "./capability/index.js";
export * from "./checkpoint/index.js";
export * from "./compensation/index.js";
export type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "./middleware/i-execution-middleware.js";
export type { IExecutionPermissionChecker } from "./middleware/i-execution-permission-checker.js";
export type {
  ExecutionValidationInput,
  ExecutionValidationIssue,
  ExecutionValidationResult,
  IExecutionValidator,
} from "./validator/i-execution-validator.js";
export type { ExecutionMetricsSnapshot, IExecutionMetrics } from "./metrics/i-execution-metrics.js";
export type {
  ComponentHealth,
  ExecutionHealthReport,
  HealthStatus,
} from "./health/i-health-check.js";
export type {
  ExecutionSnapshot,
  ExecutionTrace,
  ExecutionTreeNode,
} from "./monitoring/execution-monitor.js";

// Events — required to subscribe on @aos/event-bus, and to construct the Engine.
export * from "./events/index.js";

// Errors — required to catch specific failure modes.
export * from "./errors/index.js";

// Config — required to construct a WorkflowExecutionEngine/WorkflowExecutionSystem.
export type { WorkflowExecutionConfig } from "./config/workflow-execution-config.js";
