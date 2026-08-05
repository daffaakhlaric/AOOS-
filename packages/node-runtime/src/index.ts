/**
 * "PUBLIC API: Expose ONLY: NodeRuntime. Everything else internal."
 * (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md). `NodeRuntime` (and its Kernel Module
 * wrapper `NodeRuntimeSystem`) are the only *service* classes this package exports — every
 * concrete internal implementation (`NodeRegistry`, `NodeResolver`, `NodeFactory`, the
 * Validator/Lifecycle/Middleware/Metrics/Health/Monitoring/Events concrete classes, the
 * in-memory Execution Coordinator) stays unexported. What remains exported below is the
 * data-contract surface (types/interfaces/enums/errors) required to actually call
 * `NodeRuntime`'s methods and interpret their results — an unavoidable minimum for a
 * usable TypeScript public API, not a loophole around the directive above.
 */
export { NodeRuntime } from "./runtime/node-runtime.js";
export type { CreateNodeInstanceOptions, NodeRuntimeOptions } from "./runtime/node-runtime.js";
export { NodeRuntimeSystem } from "./bootstrap/node-runtime-system.js";

// Contracts — the data shapes every NodeRuntime call site needs (NodeType/NodeCategory/
// NodeState/ExecutionMode/NodeManifest, the 12 AI-native manifests, and the interface-only
// Executor/AI/Knowledge/Memory contracts this Engineering Task designed but never implements).
export * from "./contracts/index.js";

// Factory input shapes — required to call createFromDefinition()/createFromRegistry()/createFromBlueprint().
export type {
  CreateFromBlueprintInput,
  CreateFromDefinitionInput,
  CreateFromRegistryInput,
  NodeBlueprint,
} from "./factory/i-node-factory.js";

// Instance/Context/History/Result/Snapshot — the shapes NodeRuntime's methods return.
export * from "./instance/index.js";
export * from "./context/index.js";

// Lifecycle contracts (Compensate is interface-only, per this package's scope boundary).
export type {
  INodeCompensatable,
  INodeLifecycleManager,
} from "./lifecycle/i-node-lifecycle-manager.js";

// Middleware — required to author a custom Middleware for runtime.use().
export type {
  INodeMiddleware,
  NodeMiddlewareContext,
  NodeMiddlewareNext,
} from "./middleware/i-node-middleware.js";
export type { INodePermissionChecker } from "./middleware/i-node-permission-checker.js";

// Validation result shape — needed to interpret validate()'s thrown NodeValidationException detail, and NODE VALIDATION's INodeValidator extension point.
export type {
  INodeValidator,
  NodeValidationIssue,
  NodeValidationResult,
} from "./validator/i-node-validator.js";

// Events — required to subscribe on @aos/event-bus for this package's node.* namespace.
export * from "./events/index.js";

// Metrics/Health/Monitoring snapshot shapes — needed to interpret runtime.metrics()/health()/monitorSnapshot().
export type {
  INodeRuntimeMetrics,
  NodeRuntimeMetricsSnapshot,
} from "./metrics/i-node-runtime-metrics.js";
export type {
  ComponentHealth,
  HealthStatus,
  NodeRuntimeHealthReport,
} from "./health/i-health-check.js";
export type { NodeRuntimeSnapshot } from "./monitoring/node-runtime-monitor.js";

// Errors — required to catch specific failure modes.
export * from "./errors/index.js";

// Config — required to construct a NodeRuntime/NodeRuntimeSystem.
export type { NodeRuntimeConfig } from "./config/node-runtime-config.js";
