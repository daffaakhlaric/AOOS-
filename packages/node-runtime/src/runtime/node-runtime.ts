import { InMemoryTracer, type ITracer } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";

import { DEFAULT_EXECUTION_MODE, type NodeRuntimeConfig } from "../config/node-runtime-config.js";
import { createNodeContext } from "../context/create-node-context.js";
import type { ExecutionMode } from "../contracts/execution-mode.js";
import { NodeState } from "../contracts/node-state.js";
import { NodeValidationException } from "../errors/node-validation-exception.js";
import type { NodeRuntimeEventPublisher } from "../events/node-runtime-event-publisher.js";
import { NodeRuntimeEventType } from "../events/node-runtime-event-type.js";
import {
  NodeFactory,
  type CreateFromBlueprintInput,
  type CreateFromDefinitionInput,
  type CreateFromRegistryInput,
} from "../factory/index.js";
import type { NodeRuntimeHealthReport } from "../health/i-health-check.js";
import type { NodeExecution } from "../instance/node-execution.js";
import type { NodeInstance } from "../instance/node-instance.js";
import { createNodeSnapshot, type NodeSnapshot } from "../instance/node-snapshot.js";
import { NodeLifecycleManager } from "../lifecycle/node-lifecycle-manager.js";
import { NodeStateMachine } from "../lifecycle/node-state-machine.js";
import type { NodeRuntimeMetricsSnapshot } from "../metrics/i-node-runtime-metrics.js";
import { NodeRuntimeMetricsCollector } from "../metrics/node-runtime-metrics-collector.js";
import type { INodeMiddleware, NodeMiddlewareContext } from "../middleware/i-node-middleware.js";
import { LifecycleMiddleware } from "../middleware/lifecycle-middleware.js";
import { LoggingMiddleware } from "../middleware/logging-middleware.js";
import { MetricsMiddleware } from "../middleware/metrics-middleware.js";
import { NodeMiddlewarePipeline } from "../middleware/node-middleware-pipeline.js";
import { PermissionMiddleware } from "../middleware/permission-middleware.js";
import { TracingMiddleware } from "../middleware/tracing-middleware.js";
import { ValidationMiddleware } from "../middleware/validation-middleware.js";
import {
  NodeRuntimeMonitor,
  type NodeRuntimeSnapshot,
} from "../monitoring/node-runtime-monitor.js";
import { NodeRegistry } from "../registry/node-registry.js";
import { NodeResolver } from "../resolver/node-resolver.js";
import { ValidationPipeline } from "../validator/validation-pipeline.js";

import { NodeExecutionCoordinator } from "./node-execution-coordinator.js";
import { NodeOperationEventMap } from "./node-operation-event-map.js";

export interface CreateNodeInstanceOptions {
  readonly tenantId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly variables?: Readonly<Record<string, unknown>>;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly contextMetadata?: Readonly<Record<string, unknown>>;
  readonly executionMode?: ExecutionMode;
}

export interface NodeRuntimeOptions {
  readonly eventPublisher: NodeRuntimeEventPublisher;
  readonly config?: NodeRuntimeConfig;
}

type LifecycleOperation =
  | "initialize"
  | "validate"
  | "prepare"
  | "start"
  | "pause"
  | "resume"
  | "complete"
  | "fail"
  | "cancel"
  | "timeout";

/**
 * The Enterprise Node Runtime's entire public API (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md —
 * "PUBLIC API: Expose ONLY: NodeRuntime. Everything else internal."). Composes
 * Registry/Resolver/Factory/Validator/State Machine/Lifecycle/Coordinator/Metrics/Health/
 * Events behind one façade.
 */
export class NodeRuntime {
  private readonly options: NodeRuntimeOptions;
  private readonly registry: NodeRegistry;
  private readonly resolver: NodeResolver;
  private readonly factory: NodeFactory;
  private readonly validationPipeline = new ValidationPipeline();
  private readonly stateMachine = new NodeStateMachine();
  private readonly lifecycleManager: NodeLifecycleManager;
  private readonly coordinator = new NodeExecutionCoordinator();
  private readonly metricsCollector = new NodeRuntimeMetricsCollector();
  private readonly monitor: NodeRuntimeMonitor;
  private readonly tracer: ITracer;
  private readonly logger: Logger;
  private readonly baseMiddlewares: readonly INodeMiddleware[];
  private readonly extraMiddlewares: INodeMiddleware[] = [];
  private readonly lifecycleMiddleware: INodeMiddleware;
  private pipeline: NodeMiddlewarePipeline;

  constructor(options: NodeRuntimeOptions) {
    this.options = options;
    this.registry = new NodeRegistry(options.config?.manifests);
    this.resolver = new NodeResolver(this.registry);
    this.factory = new NodeFactory(this.registry, this.resolver);
    this.lifecycleManager = new NodeLifecycleManager(this.stateMachine, this.validationPipeline);
    this.monitor = new NodeRuntimeMonitor(this.metricsCollector);
    this.tracer = options.config?.tracer ?? new InMemoryTracer();
    this.logger = options.config?.logger ?? createLogger({ serviceName: "node-runtime" });
    this.baseMiddlewares = [
      new ValidationMiddleware(this.validationPipeline),
      new PermissionMiddleware(options.config?.permissionChecker),
      new TracingMiddleware(this.tracer),
      new MetricsMiddleware(this.metricsCollector),
      new LoggingMiddleware(this.logger),
    ];
    this.lifecycleMiddleware = new LifecycleMiddleware(this.lifecycleManager);
    this.pipeline = this.buildPipeline();
  }

  /** Registers an additional Middleware — always runs before the terminal Lifecycle stage, in `use()` call order. */
  use(middleware: INodeMiddleware): this {
    this.extraMiddlewares.push(middleware);
    this.pipeline = this.buildPipeline();
    return this;
  }

  async createFromDefinition(
    input: CreateFromDefinitionInput,
    options: CreateNodeInstanceOptions = {},
  ): Promise<NodeExecution> {
    return this.finishCreate(this.factory.createFromDefinition(input), options);
  }

  async createFromRegistry(
    input: CreateFromRegistryInput,
    options: CreateNodeInstanceOptions = {},
  ): Promise<NodeExecution> {
    return this.finishCreate(this.factory.createFromRegistry(input), options);
  }

  async createFromBlueprint(
    input: CreateFromBlueprintInput,
    options: CreateNodeInstanceOptions = {},
  ): Promise<NodeExecution> {
    return this.finishCreate(this.factory.createFromBlueprint(input), options);
  }

  async initialize(id: string): Promise<NodeExecution> {
    return this.runOperation(id, "initialize");
  }

  async validate(id: string): Promise<NodeExecution> {
    return this.runOperation(id, "validate");
  }

  async prepare(id: string): Promise<NodeExecution> {
    return this.runOperation(id, "prepare");
  }

  async start(id: string): Promise<NodeExecution> {
    return this.runOperation(id, "start");
  }

  async pause(id: string, reason?: string): Promise<NodeExecution> {
    return this.runOperation(id, "pause", reason);
  }

  async resume(id: string): Promise<NodeExecution> {
    return this.runOperation(id, "resume");
  }

  async complete(id: string): Promise<NodeExecution> {
    return this.runOperation(id, "complete");
  }

  async fail(id: string, reason?: string): Promise<NodeExecution> {
    return this.runOperation(id, "fail", reason);
  }

  async cancel(id: string, reason?: string): Promise<NodeExecution> {
    return this.runOperation(id, "cancel", reason);
  }

  async timeout(id: string): Promise<NodeExecution> {
    return this.runOperation(id, "timeout");
  }

  getInstance(id: string): NodeExecution | undefined {
    return this.coordinator.get(id);
  }

  requireInstance(id: string): NodeExecution {
    return this.coordinator.require(id);
  }

  listInstances(workflowInstanceId?: string): readonly NodeExecution[] {
    return this.coordinator.list(workflowInstanceId);
  }

  snapshot(id: string): NodeSnapshot {
    return createNodeSnapshot(this.coordinator.require(id));
  }

  health(): NodeRuntimeHealthReport {
    return this.monitor.health.check();
  }

  metrics(): NodeRuntimeMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): NodeRuntimeSnapshot {
    return this.monitor.sample();
  }

  private async finishCreate(
    createdInstance: NodeInstance,
    options: CreateNodeInstanceOptions,
  ): Promise<NodeExecution> {
    const manifest = this.resolver.resolveType(createdInstance.type);
    const context = createNodeContext({
      tenantId: options.tenantId,
      workflowInstanceId: createdInstance.workflowInstanceId,
      nodeId: createdInstance.nodeId,
      traceId: options.traceId,
      correlationId: options.correlationId,
      input: options.input,
      variables: options.variables,
      metadata: options.contextMetadata,
      executionMode:
        options.executionMode ??
        this.options.config?.defaultExecutionMode ??
        DEFAULT_EXECUTION_MODE,
    });

    const execution: NodeExecution = { manifest, instance: createdInstance, context, history: [] };

    const validation = this.validationPipeline.run(execution);
    if (!validation.valid) {
      throw new NodeValidationException(
        `Node Instance "${createdInstance.id}" failed runtime validation: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    this.coordinator.register(execution);
    this.metricsCollector.recordNodeCreated(createdInstance.type);
    await this.options.eventPublisher.publishNodeEvent(
      NodeRuntimeEventType.CREATED,
      execution.instance,
    );
    return execution;
  }

  private buildPipeline(): NodeMiddlewarePipeline {
    const pipeline = new NodeMiddlewarePipeline();
    for (const middleware of [
      ...this.baseMiddlewares,
      ...this.extraMiddlewares,
      this.lifecycleMiddleware,
    ]) {
      pipeline.use(middleware);
    }
    return pipeline;
  }

  private async runOperation(
    id: string,
    operation: LifecycleOperation,
    reason?: string,
  ): Promise<NodeExecution> {
    const before = this.coordinator.require(id);
    const context: NodeMiddlewareContext = {
      execution: before,
      operation,
      metadata: reason === undefined ? {} : { reason },
    };
    const after = await this.pipeline.execute(context);
    this.coordinator.update(after);
    this.recordTransitionMetrics(after);

    const eventType = NodeOperationEventMap[operation];
    if (eventType) {
      await this.options.eventPublisher.publishNodeEvent(eventType, after.instance);
    }
    if (before.instance.status !== after.instance.status) {
      await this.options.eventPublisher.publishNodeEvent(
        NodeRuntimeEventType.STATE_CHANGED,
        after.instance,
        {
          fromState: before.instance.status,
          toState: after.instance.status,
        },
      );
    }
    return after;
  }

  private recordTransitionMetrics(execution: NodeExecution): void {
    if (execution.instance.status === NodeState.COMPLETED) {
      const startedAt = execution.instance.startedAt
        ? Date.parse(execution.instance.startedAt)
        : Date.parse(execution.instance.createdAt);
      const completedAt = execution.instance.completedAt
        ? Date.parse(execution.instance.completedAt)
        : Date.now();
      this.metricsCollector.recordNodeSuccess(Math.max(0, completedAt - startedAt));
    } else if (execution.instance.status === NodeState.FAILED) {
      this.metricsCollector.recordNodeFailure();
    }
  }
}
