import { InMemoryTracer, type ITracer } from "@aos/event-bus";
import type { KnowledgeEngine } from "@aos/knowledge-engine";

import type { KnowledgeRuntimeConfig } from "../config/knowledge-runtime-config.js";
import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeSnapshot } from "../domain/knowledge-runtime-snapshot.js";
import { ReplayNotSupportedException } from "../errors/replay-not-supported-exception.js";
import { RuntimeValidationException } from "../errors/runtime-validation-exception.js";
import { KnowledgeRuntimeEventType } from "../events/knowledge-runtime-event-type.js";
import type { KnowledgeRuntimeEvents } from "../events/knowledge-runtime-events.js";
import { KnowledgeRuntimeFactory } from "../factory/knowledge-runtime-factory.js";
import type { CreateKnowledgeRuntimeExecutionInput } from "../factory/knowledge-runtime-factory.js";
import type { KnowledgeRuntimeHealthReport } from "../health/i-health-check.js";
import { KnowledgeRuntimeLifecycle } from "../lifecycle/knowledge-runtime-lifecycle.js";
import { KnowledgeRuntimeLoader } from "../loader/knowledge-runtime-loader.js";
import { KnowledgeRuntimeManager } from "../manager/knowledge-runtime-manager.js";
import type { KnowledgeRuntimeMetricsSnapshot } from "../metrics/i-knowledge-runtime-metrics.js";
import { KnowledgeRuntimeMetrics } from "../metrics/knowledge-runtime-metrics.js";
import {
  ConsoleKnowledgeRuntimeLogger,
  ContextMiddleware,
  LifecycleMiddleware,
  type LifecycleOperation,
  LoggingMiddleware,
  MetricsMiddleware,
  KnowledgeRuntimeMiddleware,
  PermissionMiddleware,
  PolicyMiddleware,
  TracingMiddleware,
  ValidationMiddleware,
  type IKnowledgeRuntimeMiddleware,
  type RuntimeMiddlewareContext,
} from "../middleware/index.js";
import type { KnowledgeRuntimeDashboard } from "../monitoring/knowledge-runtime-monitor.js";
import { KnowledgeRuntimeMonitor } from "../monitoring/knowledge-runtime-monitor.js";
import { KnowledgeRuntimeResolver } from "../resolver/knowledge-runtime-resolver.js";
import { KnowledgeRuntimeStateMachine } from "../state-machine/knowledge-runtime-state-machine.js";
import { KnowledgeRuntimeValidator } from "../validator/knowledge-runtime-validator.js";

import { LIFECYCLE_EVENT_MAP } from "./lifecycle-event-map.js";

export interface KnowledgeRuntimeOptions {
  readonly knowledgeEngine: KnowledgeEngine;
  readonly events: KnowledgeRuntimeEvents;
  readonly config?: KnowledgeRuntimeConfig;
}

/**
 * "Knowledge Runtime is the bridge between Knowledge Engine ↓ Workflow Runtime ↓ Memory ↓
 * Prompt Intelligence ↓ Capability Runtime ↓ Agent Runtime. It never performs AI
 * operations. It only manages runtime state." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) —
 * the public façade. Composes Factory/Manager/Loader/Resolver/Validator/State Machine/
 * Lifecycle/Middleware Pipeline/Events/Metrics/Health/Monitor behind one entry point.
 */
export class KnowledgeRuntime {
  private readonly options: KnowledgeRuntimeOptions;
  readonly factory = new KnowledgeRuntimeFactory();
  readonly manager = new KnowledgeRuntimeManager();
  readonly loader: KnowledgeRuntimeLoader;
  readonly resolver: KnowledgeRuntimeResolver;
  readonly validator = new KnowledgeRuntimeValidator();
  readonly stateMachine = new KnowledgeRuntimeStateMachine();
  readonly lifecycle: KnowledgeRuntimeLifecycle;
  private readonly metricsCollector = new KnowledgeRuntimeMetrics();
  private readonly monitor: KnowledgeRuntimeMonitor;
  private readonly tracer: ITracer;
  private readonly baseMiddlewares: readonly IKnowledgeRuntimeMiddleware[];
  private readonly extraMiddlewares: IKnowledgeRuntimeMiddleware[] = [];
  private readonly lifecycleMiddleware: IKnowledgeRuntimeMiddleware;
  private readonly loggingMiddleware: IKnowledgeRuntimeMiddleware;
  private pipeline: KnowledgeRuntimeMiddleware;

  constructor(options: KnowledgeRuntimeOptions) {
    this.options = options;
    const engine = options.knowledgeEngine;
    this.loader = new KnowledgeRuntimeLoader(engine.repository, engine.catalog, engine.registry);
    this.resolver = new KnowledgeRuntimeResolver(
      engine.repository,
      engine.relationshipEngine,
      engine.policyEngine,
      engine.permissionEngine,
      engine.versionEngine,
      engine.templateEngine,
    );
    this.lifecycle = new KnowledgeRuntimeLifecycle(this.stateMachine);
    this.monitor = new KnowledgeRuntimeMonitor(this.metricsCollector, this.manager.registry);
    this.tracer = options.config?.tracer ?? new InMemoryTracer();
    this.baseMiddlewares = [
      new ValidationMiddleware(this.validator, {
        allowedTenantIds: options.config?.allowedTenantIds,
        allowedWorkspaceIds: options.config?.allowedWorkspaceIds,
      }),
      new ContextMiddleware(),
      new PermissionMiddleware(options.config?.permissionChecker),
      new PolicyMiddleware(options.config?.policyChecker),
      new TracingMiddleware(this.tracer),
      new MetricsMiddleware(this.metricsCollector),
    ];
    this.lifecycleMiddleware = new LifecycleMiddleware(this.lifecycle);
    this.loggingMiddleware = new LoggingMiddleware(
      options.config?.logger ?? new ConsoleKnowledgeRuntimeLogger(),
    );
    this.pipeline = this.buildPipeline();
  }

  /** Registers an additional Middleware (e.g. audit/billing/quota) — always runs after Logging (the terminal stage), in `use()` call order, matching the source prompt's "Custom Middleware" position at the end of the pipeline. */
  use(middleware: IKnowledgeRuntimeMiddleware): this {
    this.extraMiddlewares.push(middleware);
    this.pipeline = this.buildPipeline();
    return this;
  }

  async createInstance(
    input: CreateKnowledgeRuntimeExecutionInput,
  ): Promise<KnowledgeRuntimeExecution> {
    const execution = this.factory.createExecution(input);
    this.manager.register(execution);
    this.metricsCollector.recordInstanceCreated();
    this.metricsCollector.recordStateChange(execution.instance.state);
    await this.options.events.publishRuntimeEvent(
      KnowledgeRuntimeEventType.CREATED,
      execution.context,
    );
    return execution;
  }

  async load(token: string): Promise<KnowledgeRuntimeExecution> {
    const startedAt = performance.now();
    const before = this.manager.require(token);
    this.loader.loadById(before.instance.knowledgeId);
    this.metricsCollector.recordLoadTime(performance.now() - startedAt);
    await this.runOperation(token, "load");
    return this.runOperation(token, "markLoaded");
  }

  async validate(token: string): Promise<KnowledgeRuntimeExecution> {
    await this.runOperation(token, "validate");
    return this.runOperation(token, "markReady");
  }

  async start(token: string): Promise<KnowledgeRuntimeExecution> {
    return this.runOperation(token, "start");
  }

  async suspend(token: string, reason?: string): Promise<KnowledgeRuntimeExecution> {
    const result = await this.runOperation(token, "suspend", reason);
    this.metricsCollector.recordInstanceSuspended();
    return result;
  }

  async resume(token: string): Promise<KnowledgeRuntimeExecution> {
    await this.runOperation(token, "resume");
    const result = await this.runOperation(token, "markResumed");
    this.metricsCollector.recordInstanceResumed();
    return result;
  }

  async complete(token: string): Promise<KnowledgeRuntimeExecution> {
    const result = await this.runOperation(token, "complete");
    this.metricsCollector.recordInstanceCompleted(this.executionTimeMs(result));
    return result;
  }

  async fail(token: string, reason?: string): Promise<KnowledgeRuntimeExecution> {
    const result = await this.runOperation(token, "fail", reason);
    this.metricsCollector.recordInstanceFailed();
    return result;
  }

  async cancel(token: string, reason?: string): Promise<KnowledgeRuntimeExecution> {
    return this.runOperation(token, "cancel", reason);
  }

  async expire(token: string): Promise<KnowledgeRuntimeExecution> {
    return this.runOperation(token, "expire");
  }

  async destroy(token: string): Promise<KnowledgeRuntimeExecution> {
    const result = await this.runOperation(token, "destroy");
    this.manager.unregister(token);
    return result;
  }

  getInstance(token: string): KnowledgeRuntimeExecution | undefined {
    return this.manager.get(token);
  }

  requireInstance(token: string): KnowledgeRuntimeExecution {
    return this.manager.require(token);
  }

  listInstances(tenantId?: string): readonly KnowledgeRuntimeExecution[] {
    return this.manager.list(tenantId);
  }

  async snapshot(token: string): Promise<KnowledgeRuntimeSnapshot> {
    return this.manager.snapshot(token);
  }

  listSnapshots(token: string): readonly KnowledgeRuntimeSnapshot[] {
    return this.manager.listSnapshots(token);
  }

  /** Delegates to the configured `IKnowledgeRuntimeReplay` — throws `ReplayNotSupportedException` when none is configured (Replay is an interface-only integration point in this package). */
  replay(
    token: string,
  ): ReturnType<NonNullable<KnowledgeRuntimeConfig["replayProvider"]>["replayInstance"]> {
    this.manager.require(token);
    if (!this.options.config?.replayProvider) {
      throw new ReplayNotSupportedException(
        `Cannot replay Token "${token}": no IKnowledgeRuntimeReplay provider is configured`,
      );
    }
    return this.options.config.replayProvider.replayInstance(token);
  }

  health(): KnowledgeRuntimeHealthReport {
    return this.monitor.health.check();
  }

  metrics(): KnowledgeRuntimeMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): KnowledgeRuntimeDashboard {
    return this.monitor.sample();
  }

  private buildPipeline(): KnowledgeRuntimeMiddleware {
    const pipeline = new KnowledgeRuntimeMiddleware();
    for (const middleware of [
      ...this.baseMiddlewares,
      this.lifecycleMiddleware,
      this.loggingMiddleware,
      ...this.extraMiddlewares,
    ]) {
      pipeline.use(middleware);
    }
    return pipeline;
  }

  private async runOperation(
    token: string,
    operation: LifecycleOperation,
    reason?: string,
  ): Promise<KnowledgeRuntimeExecution> {
    const before = this.manager.require(token);
    const context: RuntimeMiddlewareContext = {
      execution: before,
      operation,
      metadata: reason === undefined ? {} : { reason },
    };

    try {
      const after = await this.pipeline.execute(context);
      this.manager.update(after);
      this.metricsCollector.recordStateChange(after.instance.state, before.instance.state);

      const eventType = LIFECYCLE_EVENT_MAP[operation];
      if (eventType) {
        await this.options.events.publishRuntimeEvent(eventType, after.context, {
          fromState: before.instance.state,
          toState: after.instance.state,
        });
      }
      return after;
    } catch (error) {
      if (error instanceof RuntimeValidationException) {
        this.metricsCollector.recordValidationFailure();
        await this.options.events.publishRuntimeEvent(
          KnowledgeRuntimeEventType.VALIDATION_FAILED,
          before.context,
          { operation, message: error.message },
        );
      }
      throw error;
    }
  }

  private executionTimeMs(execution: KnowledgeRuntimeExecution): number {
    const startedAt = execution.instance.startedAt
      ? Date.parse(execution.instance.startedAt)
      : Date.parse(execution.instance.createdAt);
    const completedAt = execution.instance.completedAt
      ? Date.parse(execution.instance.completedAt)
      : Date.now();
    return Math.max(0, completedAt - startedAt);
  }
}
