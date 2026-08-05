import type { IIntegrationAdapter } from "../adapter/i-integration-adapter.js";
import type { WorkflowIntegrationConfig } from "../config/workflow-integration-config.js";
import type { WorkflowIntegrationContext } from "../context/workflow-integration-context.js";
import type { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { IntegrationRequest } from "../contracts/integration-request.js";
import { IntegrationValidationException } from "../errors/integration-validation-exception.js";
import type { WorkflowIntegrationEventPublisher } from "../events/workflow-integration-event-publisher.js";
import { WorkflowIntegrationEventType } from "../events/workflow-integration-event-type.js";
import type { WorkflowIntegrationHealthReport } from "../health/i-health-check.js";
import type { WorkflowIntegrationMetricsSnapshot } from "../metrics/i-workflow-integration-metrics.js";
import { WorkflowIntegrationMetrics } from "../metrics/workflow-integration-metrics.js";
import type { IWorkflowIntegrationMiddleware } from "../middleware/i-workflow-integration-middleware.js";
import {
  WorkflowIntegrationMonitor,
  type IntegrationDashboard,
} from "../monitoring/workflow-integration-monitor.js";
import type { IntegrateOutcome } from "../pipeline/workflow-integration-pipeline.js";
import { WorkflowIntegrationPipeline } from "../pipeline/workflow-integration-pipeline.js";
import { WorkflowIntegrationRegistry } from "../registry/workflow-integration-registry.js";
import type { ResolveAdapterOptions } from "../registry/workflow-integration-registry.js";
import { WorkflowIntegrationResolver } from "../resolver/workflow-integration-resolver.js";

export interface WorkflowIntegrationOptions {
  readonly eventPublisher: WorkflowIntegrationEventPublisher;
  readonly config?: WorkflowIntegrationConfig;
}

/**
 * "Become the integration bridge between Workflow Runtime and every future runtime ...
 * The package MUST know every contract. The package MUST execute nothing."
 * (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). The public façade — never itself
 * implements a Capability/Tool/Connector/Knowledge/Memory/Model/Agent/Prompt/Experience;
 * it only orchestrates Registry → Resolver → Middleware → the resolved Adapter's own
 * `execute()`.
 */
export class WorkflowIntegration {
  readonly registry = new WorkflowIntegrationRegistry();
  private readonly resolver: WorkflowIntegrationResolver;
  private readonly metricsCollector = new WorkflowIntegrationMetrics();
  private readonly monitor: WorkflowIntegrationMonitor;
  private readonly pipeline: WorkflowIntegrationPipeline;

  constructor(private readonly options: WorkflowIntegrationOptions) {
    this.resolver = new WorkflowIntegrationResolver(this.registry);
    this.monitor = new WorkflowIntegrationMonitor(this.metricsCollector, this.registry);
    this.pipeline = new WorkflowIntegrationPipeline({
      registry: this.registry,
      resolver: this.resolver,
      metrics: this.metricsCollector,
      eventPublisher: options.eventPublisher,
      config: options.config,
    });
  }

  registerAdapter(adapter: IIntegrationAdapter): this {
    this.registry.register(adapter);
    return this;
  }

  replaceAdapter(adapter: IIntegrationAdapter): this {
    this.registry.replace(adapter);
    return this;
  }

  removeAdapter(namespace: IntegrationNamespace, name: string, version?: string): boolean {
    return this.registry.remove(namespace, name, version);
  }

  /** Registers an additional Middleware — always runs before the terminal Adapter-execution stage, in `use()` call order. */
  use(middleware: IWorkflowIntegrationMiddleware): this {
    this.pipeline.use(middleware);
    return this;
  }

  resolveChain(
    options?: ResolveAdapterOptions,
  ): ReadonlyMap<IntegrationNamespace, IIntegrationAdapter> {
    return this.resolver.resolveChain(options);
  }

  async integrate(
    namespace: IntegrationNamespace,
    request: IntegrationRequest,
    context: WorkflowIntegrationContext,
  ): Promise<IntegrateOutcome> {
    this.metricsCollector.recordIntegrationStarted();
    await this.options.eventPublisher.publishIntegrationEvent(
      WorkflowIntegrationEventType.STARTED,
      context,
      { namespace },
    );

    const startedAt = Date.now();
    try {
      const outcome = await this.pipeline.integrate(namespace, request, context);
      const durationMs = Date.now() - startedAt;

      if (outcome.result.success) {
        this.metricsCollector.recordIntegrationCompleted(durationMs);
        await this.options.eventPublisher.publishIntegrationEvent(
          WorkflowIntegrationEventType.COMPLETED,
          outcome.context,
          { namespace },
        );
      } else {
        this.metricsCollector.recordIntegrationFailed();
        await this.options.eventPublisher.publishIntegrationEvent(
          WorkflowIntegrationEventType.FAILED,
          outcome.context,
          {
            namespace,
            error: outcome.result.error,
          },
        );
      }
      return outcome;
    } catch (error) {
      this.metricsCollector.recordIntegrationFailed();
      const eventType =
        error instanceof IntegrationValidationException
          ? WorkflowIntegrationEventType.VALIDATION_FAILED
          : WorkflowIntegrationEventType.FAILED;
      await this.options.eventPublisher.publishIntegrationEvent(eventType, context, {
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  health(): WorkflowIntegrationHealthReport {
    return this.monitor.health.check();
  }

  metrics(): WorkflowIntegrationMetricsSnapshot {
    return this.metricsCollector.snapshot();
  }

  monitorSnapshot(): IntegrationDashboard {
    return this.monitor.sample();
  }
}
