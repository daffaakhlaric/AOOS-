import type { BaseEventShape, ITracer } from "@aos/event-bus";
import { InMemoryTracer } from "@aos/event-bus";
import type { IWorkflowDefinitionRegistry } from "@aos/workflow-definition";

import {
  DEFAULT_EXECUTION_MODE,
  type WorkflowRuntimeConfig,
} from "../config/workflow-runtime-config.js";
import { createWorkflowContext } from "../context/create-workflow-context.js";
import type { ExecutionMode } from "../context/execution-mode.js";
import { ReplayNotSupportedException } from "../errors/replay-not-supported-exception.js";
import { WorkflowValidationException } from "../errors/workflow-validation-exception.js";
import type { WorkflowRuntimeEventPublisher } from "../events/workflow-runtime-event-publisher.js";
import { WorkflowRuntimeEventType } from "../events/workflow-runtime-event-type.js";
import { WorkflowExecutionCoordinator } from "../execution/workflow-execution-coordinator.js";
import type { WorkflowRuntimeHealthReport } from "../health/i-health-check.js";
import { createWorkflowInstance } from "../instance/create-workflow-instance.js";
import type { ExecutionToken } from "../instance/execution-token.js";
import { InstanceState } from "../instance/instance-state.js";
import type { WorkflowExecution } from "../instance/workflow-execution.js";
import type { WorkflowInstanceMetadata } from "../instance/workflow-instance-metadata.js";
import { WorkflowLifecycleManager } from "../lifecycle/workflow-lifecycle-manager.js";
import { WorkflowLoader } from "../loader/workflow-loader.js";
import type { WorkflowRuntimeMetricsSnapshot } from "../metrics/i-workflow-runtime-metrics.js";
import { WorkflowRuntimeMetricsCollector } from "../metrics/workflow-runtime-metrics-collector.js";
import type {
  IRuntimeMiddleware,
  RuntimeMiddlewareContext,
} from "../middleware/i-runtime-middleware.js";
import { LifecycleMiddleware } from "../middleware/lifecycle-middleware.js";
import { MetricsMiddleware } from "../middleware/metrics-middleware.js";
import { RuntimeMiddlewarePipeline } from "../middleware/middleware-pipeline.js";
import { PermissionMiddleware } from "../middleware/permission-middleware.js";
import { TracingMiddleware } from "../middleware/tracing-middleware.js";
import { ValidationMiddleware } from "../middleware/validation-middleware.js";
import {
  WorkflowRuntimeMonitor,
  type WorkflowRuntimeSnapshot,
} from "../monitoring/workflow-runtime-monitor.js";
import { WorkflowResolver } from "../resolver/workflow-resolver.js";
import type { WorkflowSnapshot } from "../snapshot/i-snapshot.js";
import { SnapshotManager } from "../snapshot/snapshot-manager.js";
import { WorkflowStateMachine } from "../state-machine/workflow-state-machine.js";
import { WorkflowRuntimeValidator } from "../validator/workflow-runtime-validator.js";

import { WorkflowExecutionEventMap } from "./workflow-execution-event-map.js";

export interface CreateInstanceInput {
  readonly workflowId: string;
  /** Omit to load the latest registered version. */
  readonly workflowVersion?: string;
  readonly tenantId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly workflowVariables?: Readonly<Record<string, unknown>>;
  readonly environmentVariables?: Readonly<Record<string, unknown>>;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly metadata?: WorkflowInstanceMetadata;
  readonly executionMode?: ExecutionMode;
}

export interface WorkflowRuntimeOptions {
  readonly definitionRegistry: IWorkflowDefinitionRegistry;
  readonly eventPublisher: WorkflowRuntimeEventPublisher;
  readonly config?: WorkflowRuntimeConfig;
}

type LifecycleOperation =
  "initialize" | "start" | "pause" | "resume" | "cancel" | "expire" | "complete" | "fail";

/**
 * The Workflow Runtime Core's small, stable public API (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md's
 * closing note: "every package should have a small, stable public API"). Composes
 * Loader/Resolver/Validator/State Machine/Lifecycle/Coordinator/Snapshot/Metrics/Health/
 * Events behind one façade — every consumer of this package should depend on
 * `WorkflowRuntime` (or `bootstrap/workflow-runtime-system.ts`'s `IModule` wrapper), never
 * on the internal modules directly.
 */
export class WorkflowRuntime {
  private readonly options: WorkflowRuntimeOptions;
  private readonly loader: WorkflowLoader;
  private readonly resolver = new WorkflowResolver();
  private readonly validator = new WorkflowRuntimeValidator();
  private readonly stateMachine = new WorkflowStateMachine();
  private readonly lifecycleManager: WorkflowLifecycleManager;
  private readonly coordinator = new WorkflowExecutionCoordinator();
  private readonly snapshotManager = new SnapshotManager();
  private readonly metricsCollector = new WorkflowRuntimeMetricsCollector();
  private readonly monitor: WorkflowRuntimeMonitor;
  private readonly tracer: ITracer;
  private readonly baseMiddlewares: readonly IRuntimeMiddleware[];
  private readonly extraMiddlewares: IRuntimeMiddleware[] = [];
  private readonly lifecycleMiddleware: IRuntimeMiddleware;
  private pipeline: RuntimeMiddlewarePipeline;

  constructor(options: WorkflowRuntimeOptions) {
    this.options = options;
    this.loader = new WorkflowLoader(options.definitionRegistry);
    this.lifecycleManager = new WorkflowLifecycleManager(this.stateMachine);
    this.monitor = new WorkflowRuntimeMonitor(this.metricsCollector);
    this.tracer = options.config?.tracer ?? new InMemoryTracer();
    this.baseMiddlewares = [
      new ValidationMiddleware(this.validator),
      new PermissionMiddleware(options.config?.permissionChecker),
      new TracingMiddleware(this.tracer),
      new MetricsMiddleware(this.metricsCollector),
    ];
    this.lifecycleMiddleware = new LifecycleMiddleware(this.lifecycleManager);
    this.pipeline = this.buildPipeline();
  }

  /** Registers an additional Middleware (e.g. audit/billing/quota) — always runs before the terminal Lifecycle stage, in `use()` call order. */
  use(middleware: IRuntimeMiddleware): this {
    this.extraMiddlewares.push(middleware);
    this.pipeline = this.buildPipeline();
    return this;
  }

  async createInstance(input: CreateInstanceInput): Promise<WorkflowExecution> {
    const definition = input.workflowVersion
      ? this.loader.loadByVersion(input.workflowId, input.workflowVersion)
      : this.loader.loadLatest(input.workflowId);
    const startNode = this.resolver.resolveStartNode(definition);

    const instance = createWorkflowInstance({
      workflowId: definition.id,
      workflowVersion: definition.version,
      tenantId: input.tenantId,
      metadata: input.metadata,
    });
    const now = new Date().toISOString();

    const context = createWorkflowContext({
      tenantId: input.tenantId,
      correlationId: input.correlationId ?? instance.id,
      traceId: input.traceId,
      workflowVariables: input.workflowVariables,
      environmentVariables: input.environmentVariables,
      input: input.input,
      executionMode:
        input.executionMode ?? this.options.config?.defaultExecutionMode ?? DEFAULT_EXECUTION_MODE,
    });

    const validation = this.validator.validate(definition, context);
    if (!validation.valid) {
      throw new WorkflowValidationException(
        `Workflow Definition "${definition.id}@${definition.version}" failed runtime validation: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    const execution: WorkflowExecution = {
      definition,
      instance: { ...instance, executionPointer: { currentNodeId: startNode.id, enteredAt: now } },
      context,
    };
    this.coordinator.register(execution);
    this.metricsCollector.recordInstanceCreated();
    this.metricsCollector.recordStateChange(InstanceState.CREATED);
    await this.options.eventPublisher.publishInstanceEvent(
      WorkflowRuntimeEventType.CREATED,
      execution.instance,
    );
    return execution;
  }

  async initialize(token: ExecutionToken): Promise<WorkflowExecution> {
    return this.runOperation(token, "initialize");
  }

  async start(token: ExecutionToken): Promise<WorkflowExecution> {
    return this.runOperation(token, "start");
  }

  async pause(token: ExecutionToken, reason?: string): Promise<WorkflowExecution> {
    return this.runOperation(token, "pause", reason);
  }

  async resume(token: ExecutionToken): Promise<WorkflowExecution> {
    return this.runOperation(token, "resume");
  }

  async cancel(token: ExecutionToken, reason?: string): Promise<WorkflowExecution> {
    return this.runOperation(token, "cancel", reason);
  }

  async expire(token: ExecutionToken): Promise<WorkflowExecution> {
    return this.runOperation(token, "expire");
  }

  async complete(token: ExecutionToken): Promise<WorkflowExecution> {
    return this.runOperation(token, "complete");
  }

  async fail(token: ExecutionToken, reason?: string): Promise<WorkflowExecution> {
    return this.runOperation(token, "fail", reason);
  }

  getInstance(token: ExecutionToken): WorkflowExecution | undefined {
    return this.coordinator.get(token);
  }

  requireInstance(token: ExecutionToken): WorkflowExecution {
    return this.coordinator.require(token);
  }

  listInstances(tenantId?: string): readonly WorkflowExecution[] {
    return this.coordinator.list(tenantId);
  }

  async snapshot(token: ExecutionToken): Promise<WorkflowSnapshot> {
    const execution = this.coordinator.require(token);
    const snapshot = this.snapshotManager.capture(execution);
    const updated: WorkflowExecution = {
      ...execution,
      instance: {
        ...execution.instance,
        snapshotRef: {
          snapshotId: snapshot.id,
          sequence: snapshot.sequence,
          capturedAt: snapshot.capturedAt,
        },
      },
    };
    this.coordinator.update(updated);
    await this.options.eventPublisher.publishInstanceEvent(
      WorkflowRuntimeEventType.SNAPSHOT_CREATED,
      updated.instance,
      {
        snapshotId: snapshot.id,
        sequence: snapshot.sequence,
      },
    );
    return snapshot;
  }

  listSnapshots(token: ExecutionToken): readonly WorkflowSnapshot[] {
    return this.snapshotManager.list(token);
  }

  /** Delegates to the configured `IWorkflowReplay` — throws `ReplayNotSupportedException` when none is configured (Replay is an interface-only integration point in this package). */
  replay(
    token: ExecutionToken,
  ): AsyncIterable<BaseEventShape> | Promise<readonly BaseEventShape[]> {
    this.coordinator.require(token);
    if (!this.options.config?.replayProvider) {
      throw new ReplayNotSupportedException(
        `Cannot replay ExecutionToken "${token}": no IWorkflowReplay provider is configured`,
      );
    }
    return this.options.config.replayProvider.replayInstance(token);
  }

  health(): WorkflowRuntimeHealthReport {
    return this.monitor.health.check();
  }

  metrics(): WorkflowRuntimeMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): WorkflowRuntimeSnapshot {
    return this.monitor.sample();
  }

  private buildPipeline(): RuntimeMiddlewarePipeline {
    const pipeline = new RuntimeMiddlewarePipeline();
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
    token: ExecutionToken,
    operation: LifecycleOperation,
    reason?: string,
  ): Promise<WorkflowExecution> {
    const before = this.coordinator.require(token);
    const context: RuntimeMiddlewareContext = {
      execution: before,
      operation,
      metadata: reason === undefined ? {} : { reason },
    };
    const after = await this.pipeline.execute(context);
    this.coordinator.update(after);
    this.recordTransitionMetrics(before, after);

    const eventType = WorkflowExecutionEventMap[operation];
    await this.options.eventPublisher.publishInstanceEvent(eventType, after.instance);
    await this.options.eventPublisher.publishInstanceEvent(
      WorkflowRuntimeEventType.STATE_CHANGED,
      after.instance,
      {
        fromState: before.instance.status,
        toState: after.instance.status,
      },
    );
    return after;
  }

  private recordTransitionMetrics(before: WorkflowExecution, after: WorkflowExecution): void {
    this.metricsCollector.recordStateChange(after.instance.status, before.instance.status);
    if (after.instance.status === InstanceState.COMPLETED) {
      const startedAt = after.instance.startedAt
        ? Date.parse(after.instance.startedAt)
        : Date.parse(after.instance.createdAt);
      const completedAt = after.instance.completedAt
        ? Date.parse(after.instance.completedAt)
        : Date.now();
      this.metricsCollector.recordInstanceCompleted(Math.max(0, completedAt - startedAt));
    } else if (after.instance.status === InstanceState.FAILED) {
      this.metricsCollector.recordInstanceFailed();
    }
  }
}
