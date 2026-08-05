import { InMemoryTracer, type ITracer } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import type { NodeRuntime } from "@aos/node-runtime";
import { NodeType } from "@aos/workflow-definition";
import type { WorkflowRuntime } from "@aos/workflow-runtime";

import type { WorkflowExecutionConfig } from "../config/workflow-execution-config.js";
import { DEFAULT_MAX_LOOP_ITERATIONS } from "../config/workflow-execution-config.js";
import { createExecutionContext } from "../context/create-execution-context.js";
import { advanceCursor, createExecutionCursor, incrementLoopIteration } from "../cursor/index.js";
import { WorkflowExecutionException } from "../errors/workflow-execution-exception.js";
import type { ExecutionEventPublisher } from "../events/execution-event-publisher.js";
import { ExecutionEventType } from "../events/execution-event-type.js";
import type { ExecutionGraph } from "../graph/execution-graph.js";
import { buildExecutionGraph } from "../graph/execution-graph.js";
import type { ExecutionHealthReport } from "../health/i-health-check.js";
import { ExecutionMetricsCollector } from "../metrics/execution-metrics-collector.js";
import type { ExecutionMetricsSnapshot } from "../metrics/i-execution-metrics.js";
import { ExecutionMiddlewarePipeline } from "../middleware/execution-middleware-pipeline.js";
import type {
  IExecutionMiddleware,
  ExecutionMiddlewareContext,
} from "../middleware/i-execution-middleware.js";
import { LifecycleMiddleware } from "../middleware/lifecycle-middleware.js";
import { LoggingMiddleware } from "../middleware/logging-middleware.js";
import { MetricsMiddleware } from "../middleware/metrics-middleware.js";
import { PermissionMiddleware } from "../middleware/permission-middleware.js";
import { TracingMiddleware } from "../middleware/tracing-middleware.js";
import { ValidationMiddleware } from "../middleware/validation-middleware.js";
import {
  ExecutionMonitor,
  type ExecutionSnapshot,
  type ExecutionTrace,
  type ExecutionTreeNode,
} from "../monitoring/execution-monitor.js";
import type { ExecutionHistory } from "../result/execution-history.js";
import type { ExecutionResult } from "../result/execution-result.js";
import { EMPTY_EXECUTION_STATISTICS } from "../result/execution-statistics.js";
import { RetryCoordinator } from "../retry/retry-coordinator.js";
import { ExecutionStateMachine } from "../state-machine/execution-state-machine.js";
import { createExecutionToken } from "../token/create-execution-token.js";
import type { ExecutionToken } from "../token/execution-token.js";
import { TransitionEngine } from "../transition/transition-engine.js";
import { ExecutionValidationPipeline } from "../validator/execution-validation-pipeline.js";

import type { ExecuteWorkflowInput } from "./execute-workflow-input.js";
import { ExecutionCoordinator } from "./execution-coordinator.js";
import type { ExecutionSession } from "./execution-session.js";
import { withSessionState } from "./execution-session.js";
import type { GraphRunOutcome } from "./graph-run-outcome.js";
import type { NodeStepResult } from "./node-step-result.js";

export interface WorkflowExecutionEngineOptions {
  readonly workflowRuntime: WorkflowRuntime;
  readonly nodeRuntime: NodeRuntime;
  readonly eventPublisher: ExecutionEventPublisher;
  readonly config?: WorkflowExecutionConfig;
}

/**
 * "The Execution Engine is the ONLY component responsible for executing a Workflow
 * Instance." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). Orchestrates
 * `@aos/workflow-runtime` (Workflow Instance lifecycle) and `@aos/node-runtime` (Node
 * Instance lifecycle) to walk one Workflow Definition's graph end-to-end — it never
 * executes Node logic, AI, Tools, or Capabilities itself.
 */
export class WorkflowExecutionEngine {
  private readonly options: WorkflowExecutionEngineOptions;
  private readonly config: WorkflowExecutionConfig;
  private readonly coordinator = new ExecutionCoordinator();
  private readonly workflowRuntimeTokens = new Map<string, string>();
  private readonly validationPipeline = new ExecutionValidationPipeline();
  private readonly stateMachine = new ExecutionStateMachine();
  private readonly transitionEngine = new TransitionEngine();
  private readonly retryCoordinator = new RetryCoordinator();
  private readonly metricsCollector = new ExecutionMetricsCollector();
  private readonly monitor: ExecutionMonitor;
  private readonly tracer: ITracer;
  private readonly logger: Logger;
  private readonly baseMiddlewares: readonly IExecutionMiddleware[];
  private readonly extraMiddlewares: IExecutionMiddleware[] = [];
  private readonly lifecycleMiddleware: IExecutionMiddleware;
  private pipeline: ExecutionMiddlewarePipeline;

  constructor(options: WorkflowExecutionEngineOptions) {
    this.options = options;
    this.config = options.config ?? {};
    this.monitor = new ExecutionMonitor(this.metricsCollector);
    this.tracer = this.config.tracer ?? new InMemoryTracer();
    this.logger = this.config.logger ?? createLogger({ serviceName: "workflow-execution" });
    this.baseMiddlewares = [
      new ValidationMiddleware(this.validationPipeline),
      new PermissionMiddleware(this.config.permissionChecker),
      new TracingMiddleware(this.tracer),
      new MetricsMiddleware(this.metricsCollector),
      new LoggingMiddleware(this.logger),
    ];
    this.lifecycleMiddleware = new LifecycleMiddleware(this.stateMachine);
    this.pipeline = this.buildPipeline();
  }

  /** Registers an additional Middleware — always runs before the terminal Lifecycle stage, in `use()` call order. */
  use(middleware: IExecutionMiddleware): this {
    this.extraMiddlewares.push(middleware);
    this.pipeline = this.buildPipeline();
    return this;
  }

  async executeWorkflow(input: ExecuteWorkflowInput): Promise<ExecutionResult> {
    const workflowExecution = await this.options.workflowRuntime.createInstance({
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      traceId: input.traceId,
      workflowVariables: input.workflowVariables,
      environmentVariables: input.environmentVariables,
      input: input.input,
    });

    const token: ExecutionToken = createExecutionToken({
      tenantId: input.tenantId,
      workflowInstanceId: workflowExecution.instance.id,
      traceId: input.traceId,
      correlationId: input.correlationId,
    });
    const context = createExecutionContext({
      token,
      mode: input.mode ?? this.config.defaultMode,
      workflowVariables: input.workflowVariables,
      environmentVariables: input.environmentVariables,
    });
    const graph = buildExecutionGraph(workflowExecution.definition);
    const cursor = createExecutionCursor(graph.startNodeId);

    let session: ExecutionSession = {
      definition: workflowExecution.definition,
      context,
      cursor,
      history: [],
      statistics: EMPTY_EXECUTION_STATISTICS,
    };

    this.workflowRuntimeTokens.set(token.workflowExecutionId, workflowExecution.instance.token);
    this.coordinator.register(session);
    this.metricsCollector.recordExecutionStarted();

    session = await this.runOperation(session, "initialize");
    session = await this.runOperation(session, "start");
    await this.options.workflowRuntime.initialize(workflowExecution.instance.token);
    await this.options.workflowRuntime.start(workflowExecution.instance.token);
    await this.options.eventPublisher.publishExecutionEvent(
      ExecutionEventType.WORKFLOW_STARTED,
      token,
    );

    const startedAtMs = Date.parse(token.startedAt);
    const outcome = await this.runGraph(session, graph);
    session = outcome.session;
    const durationMs = Math.max(0, Date.now() - startedAtMs);

    if (outcome.success) {
      session = await this.runOperation(session, "complete");
      await this.options.workflowRuntime.complete(workflowExecution.instance.token);
      this.metricsCollector.recordExecutionCompleted(durationMs);
      await this.options.eventPublisher.publishExecutionEvent(
        ExecutionEventType.WORKFLOW_COMPLETED,
        token,
      );
      this.coordinator.update(session);
      return {
        success: true,
        completedAt: new Date().toISOString(),
        nodesVisited: session.cursor.visitedNodes,
      };
    }

    session = await this.runOperation(session, "fail", outcome.error);
    await this.options.workflowRuntime.fail(workflowExecution.instance.token, outcome.error);
    this.metricsCollector.recordExecutionFailed();
    await this.options.eventPublisher.publishExecutionEvent(
      ExecutionEventType.WORKFLOW_FAILED,
      token,
      { error: outcome.error },
    );
    this.coordinator.update(session);
    return {
      success: false,
      error: outcome.error,
      completedAt: new Date().toISOString(),
      nodesVisited: session.cursor.visitedNodes,
    };
  }

  async pause(workflowExecutionId: string, reason?: string): Promise<ExecutionSession> {
    let session = this.coordinator.require(workflowExecutionId);
    session = await this.runOperation(session, "pause", reason);
    const workflowRuntimeToken = this.workflowRuntimeTokens.get(workflowExecutionId);
    if (workflowRuntimeToken) {
      await this.options.workflowRuntime.pause(workflowRuntimeToken, reason);
    }
    return session;
  }

  async resume(workflowExecutionId: string): Promise<ExecutionSession> {
    let session = this.coordinator.require(workflowExecutionId);
    session = await this.runOperation(session, "resume");
    const workflowRuntimeToken = this.workflowRuntimeTokens.get(workflowExecutionId);
    if (workflowRuntimeToken) {
      await this.options.workflowRuntime.resume(workflowRuntimeToken);
    }
    return session;
  }

  async cancel(workflowExecutionId: string, reason?: string): Promise<ExecutionSession> {
    let session = this.coordinator.require(workflowExecutionId);
    session = await this.runOperation(session, "cancel", reason);
    const workflowRuntimeToken = this.workflowRuntimeTokens.get(workflowExecutionId);
    if (workflowRuntimeToken) {
      await this.options.workflowRuntime.cancel(workflowRuntimeToken, reason);
    }
    this.metricsCollector.recordExecutionCancelled();
    await this.options.eventPublisher.publishExecutionEvent(
      ExecutionEventType.WORKFLOW_CANCELLED,
      session.context.token,
      { reason },
    );
    return session;
  }

  async timeout(workflowExecutionId: string, reason?: string): Promise<ExecutionSession> {
    let session = this.coordinator.require(workflowExecutionId);
    session = await this.runOperation(session, "timeout", reason);
    this.metricsCollector.recordExecutionTimeout();
    await this.options.eventPublisher.publishExecutionEvent(
      ExecutionEventType.WORKFLOW_TIMEOUT,
      session.context.token,
      { reason },
    );
    return session;
  }

  getSession(workflowExecutionId: string): ExecutionSession | undefined {
    return this.coordinator.get(workflowExecutionId);
  }

  requireSession(workflowExecutionId: string): ExecutionSession {
    return this.coordinator.require(workflowExecutionId);
  }

  listSessions(): readonly ExecutionSession[] {
    return this.coordinator.list();
  }

  health(): ExecutionHealthReport {
    return this.monitor.health.check();
  }

  metrics(): ExecutionMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): ExecutionSnapshot {
    return this.monitor.sample();
  }

  timeline(workflowExecutionId: string): ExecutionHistory {
    return this.monitor.timeline(this.coordinator.require(workflowExecutionId));
  }

  tree(workflowExecutionId: string): readonly ExecutionTreeNode[] {
    return this.monitor.tree(this.coordinator.require(workflowExecutionId));
  }

  trace(workflowExecutionId: string): ExecutionTrace {
    return this.monitor.trace(this.coordinator.require(workflowExecutionId));
  }

  private buildPipeline(): ExecutionMiddlewarePipeline {
    const pipeline = new ExecutionMiddlewarePipeline();
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
    session: ExecutionSession,
    operation: string,
    reason?: string,
  ): Promise<ExecutionSession> {
    const context: ExecutionMiddlewareContext = {
      session,
      operation,
      metadata: reason === undefined ? {} : { reason },
    };
    const result = await this.pipeline.execute(context);
    if (this.coordinator.get(result.context.token.workflowExecutionId)) {
      this.coordinator.update(result);
    } else {
      this.coordinator.register(result);
    }
    return result;
  }

  private async runGraph(
    session: ExecutionSession,
    graph: ExecutionGraph,
  ): Promise<GraphRunOutcome> {
    let cursor = session.cursor;
    let frontier = [cursor.currentNodeId];
    let visitedFirst = false;
    let completedNodes = 0;
    let failedNodes = 0;
    let retriedNodes = 0;
    const maxLoopIterations = this.config.maxLoopIterations ?? DEFAULT_MAX_LOOP_ITERATIONS;
    const maxSteps = graph.nodeIds.length * maxLoopIterations * 4 + 10;
    let steps = 0;

    while (frontier.length > 0) {
      steps += 1;
      if (steps > maxSteps) {
        throw new WorkflowExecutionException(
          `Execution "${session.context.token.workflowExecutionId}" exceeded its maximum step bound (${maxSteps}) — possible infinite loop`,
        );
      }

      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        if (!visitedFirst) {
          visitedFirst = true;
        } else {
          cursor = advanceCursor(cursor, nodeId, frontier);
        }

        if (graph.endNodeIds.has(nodeId)) {
          await this.executeNodeOnce(session, nodeId);
          completedNodes += 1;
          continue;
        }

        const { result: stepResult, retries } = await this.executeNodeWithRetry(session, nodeId);
        retriedNodes += retries;
        if (stepResult.outcome === "success" || stepResult.outcome === "manual") {
          completedNodes += 1;
        } else if (stepResult.outcome === "failure") {
          failedNodes += 1;
        }

        const resolved = this.transitionEngine.resolve({
          graph,
          cursor,
          outcome: stepResult.outcome,
          maxLoopIterations,
        });
        if (resolved.isLoopBack) {
          cursor = incrementLoopIteration(cursor, nodeId);
        }

        if (stepResult.outcome === "failure" && resolved.nextNodeIds.length === 0) {
          const failedSession = withSessionState(session, {
            cursor,
            statistics: {
              ...session.statistics,
              totalNodes: cursor.visitedNodes.length,
              completedNodes,
              failedNodes,
              retriedNodes,
            },
          });
          return {
            session: failedSession,
            success: false,
            error:
              stepResult.reason ?? `Node "${nodeId}" failed and no Failure Transition resolves it`,
          };
        }

        for (const next of resolved.nextNodeIds) {
          if (!nextFrontier.includes(next)) {
            nextFrontier.push(next);
          }
        }
      }
      frontier = nextFrontier;
    }

    const finalSession = withSessionState(session, {
      cursor,
      statistics: {
        ...session.statistics,
        totalNodes: cursor.visitedNodes.length,
        completedNodes,
        failedNodes,
        retriedNodes,
      },
    });
    return { session: finalSession, success: true };
  }

  private async executeNodeWithRetry(
    session: ExecutionSession,
    nodeId: string,
  ): Promise<{ result: NodeStepResult; retries: number }> {
    let retries = 0;
    for (;;) {
      const result = await this.executeNodeOnce(session, nodeId);
      if (result.outcome !== "failure" || !this.config.retryPolicy) {
        return { result, retries };
      }
      try {
        const retryMeta = this.retryCoordinator.recordAttempt(nodeId, this.config.retryPolicy);
        retries += 1;
        this.metricsCollector.recordRetry();
        await this.options.eventPublisher.publishExecutionEvent(
          ExecutionEventType.NODE_RETRY,
          session.context.token,
          {
            nodeId,
            attempt: retryMeta.attempt,
            delayMs: retryMeta.delayMs,
          },
        );
      } catch {
        return { result, retries };
      }
    }
  }

  private async executeNodeOnce(
    session: ExecutionSession,
    nodeId: string,
  ): Promise<NodeStepResult> {
    const definitionNode = session.definition.nodes.find((node) => node.id === nodeId);
    if (!definitionNode) {
      return { outcome: "failure", reason: `Node "${nodeId}" not found in Workflow Definition` };
    }

    const { token } = session.context;
    const nodeExecution = await this.options.nodeRuntime.createFromDefinition(
      { workflowInstanceId: token.workflowInstanceId, definition: session.definition, nodeId },
      { tenantId: token.tenantId, correlationId: token.correlationId, traceId: token.traceId },
    );
    const id = nodeExecution.instance.id;
    await this.options.nodeRuntime.initialize(id);

    try {
      await this.options.nodeRuntime.start(id);
      await this.options.eventPublisher.publishExecutionEvent(
        ExecutionEventType.NODE_STARTED,
        token,
        { nodeId },
      );

      if (definitionNode.type === NodeType.CAPABILITY) {
        return await this.executeCapabilityNode(session, id, definitionNode);
      }

      await this.options.nodeRuntime.complete(id);
      const outcome = definitionNode.type === NodeType.HUMAN ? "manual" : "success";
      await this.options.eventPublisher.publishExecutionEvent(
        ExecutionEventType.NODE_COMPLETED,
        token,
        { nodeId },
      );
      return { outcome };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.options.nodeRuntime.fail(id, reason);
      await this.options.eventPublisher.publishExecutionEvent(
        ExecutionEventType.NODE_FAILED,
        token,
        { nodeId, error: reason },
      );
      return { outcome: "failure", reason };
    }
  }

  private async executeCapabilityNode(
    session: ExecutionSession,
    nodeInstanceId: string,
    definitionNode: {
      readonly capability: string;
      readonly capabilityVersion?: string;
      readonly id: string;
    },
  ): Promise<NodeStepResult> {
    const { token } = session.context;
    if (!this.config.capabilityExecutor) {
      const reason = `Node "${definitionNode.id}" requires Capability "${definitionNode.capability}" but no ICapabilityExecutor is configured`;
      await this.options.nodeRuntime.fail(nodeInstanceId, reason);
      await this.options.eventPublisher.publishExecutionEvent(
        ExecutionEventType.NODE_FAILED,
        token,
        { nodeId: definitionNode.id, error: reason },
      );
      return { outcome: "failure", reason };
    }

    const result = await this.config.capabilityExecutor.execute({
      capabilityId: definitionNode.capability,
      capabilityVersion: definitionNode.capabilityVersion,
      input: {},
      context: session.context,
    });

    if (!result.success) {
      const reason = result.error ?? "Capability execution failed";
      await this.options.nodeRuntime.fail(nodeInstanceId, reason);
      await this.options.eventPublisher.publishExecutionEvent(
        ExecutionEventType.NODE_FAILED,
        token,
        { nodeId: definitionNode.id, error: reason },
      );
      return { outcome: "failure", reason };
    }

    await this.options.nodeRuntime.complete(nodeInstanceId);
    await this.options.eventPublisher.publishExecutionEvent(
      ExecutionEventType.NODE_COMPLETED,
      token,
      { nodeId: definitionNode.id },
    );
    return { outcome: "success" };
  }
}
