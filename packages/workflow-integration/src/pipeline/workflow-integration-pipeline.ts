import { InMemoryTracer, type ITracer } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";

import type { WorkflowIntegrationConfig } from "../config/workflow-integration-config.js";
import { withIntegrationResult } from "../context/with-integration-result.js";
import type { WorkflowIntegrationContext } from "../context/workflow-integration-context.js";
import type { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { IntegrationRequest } from "../contracts/integration-request.js";
import type { IntegrationResult } from "../contracts/integration-result.js";
import type { WorkflowIntegrationEventPublisher } from "../events/workflow-integration-event-publisher.js";
import type { WorkflowIntegrationMetrics } from "../metrics/workflow-integration-metrics.js";
import { AuditMiddleware } from "../middleware/audit-middleware.js";
import { EnvironmentMiddleware } from "../middleware/environment-middleware.js";
import type { IWorkflowIntegrationMiddleware } from "../middleware/i-workflow-integration-middleware.js";
import { LoggingMiddleware } from "../middleware/logging-middleware.js";
import { MetricsMiddleware } from "../middleware/metrics-middleware.js";
import { PermissionMiddleware } from "../middleware/permission-middleware.js";
import { RetryMiddleware } from "../middleware/retry-middleware.js";
import { TenantMiddleware } from "../middleware/tenant-middleware.js";
import { TimeoutMiddleware } from "../middleware/timeout-middleware.js";
import { TracingMiddleware } from "../middleware/tracing-middleware.js";
import { ValidationMiddleware } from "../middleware/validation-middleware.js";
import { WorkflowIntegrationMiddleware } from "../middleware/workflow-integration-middleware.js";
import type { WorkflowIntegrationRegistry } from "../registry/workflow-integration-registry.js";
import type { WorkflowIntegrationResolver } from "../resolver/workflow-integration-resolver.js";

import { AdapterExecutionMiddleware } from "./adapter-execution-middleware.js";

export interface WorkflowIntegrationPipelineOptions {
  readonly registry: WorkflowIntegrationRegistry;
  readonly resolver: WorkflowIntegrationResolver;
  readonly metrics: WorkflowIntegrationMetrics;
  readonly eventPublisher: WorkflowIntegrationEventPublisher;
  readonly config?: WorkflowIntegrationConfig;
}

export interface IntegrateOutcome {
  readonly context: WorkflowIntegrationContext;
  readonly result: IntegrationResult;
}

/**
 * "WorkflowIntegrationPipeline" (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "PUBLIC
 * API"). Assembles the 10-stage `WorkflowIntegrationMiddleware` chain (Validation →
 * Permission → Tracing → Metrics → Tenant → Environment → Retry → Timeout → Logging →
 * Audit → the terminal `AdapterExecutionMiddleware`) and exposes the single `integrate()`
 * entry point every namespace-specific call goes through.
 */
export class WorkflowIntegrationPipeline {
  private readonly tracer: ITracer;
  private readonly logger: Logger;
  private readonly baseMiddlewares: readonly IWorkflowIntegrationMiddleware[];
  private readonly extraMiddlewares: IWorkflowIntegrationMiddleware[] = [];
  private readonly terminalMiddleware: IWorkflowIntegrationMiddleware;
  private pipeline: WorkflowIntegrationMiddleware;

  constructor(options: WorkflowIntegrationPipelineOptions) {
    const config = options.config ?? {};
    this.tracer = config.tracer ?? new InMemoryTracer();
    this.logger = config.logger ?? createLogger({ serviceName: "workflow-integration" });
    this.baseMiddlewares = [
      new ValidationMiddleware(options.registry),
      new PermissionMiddleware(config.permissionChecker),
      new TracingMiddleware(this.tracer),
      new MetricsMiddleware(options.metrics),
      new TenantMiddleware(config.requireTenantId ?? false),
      new EnvironmentMiddleware(config.allowedEnvironments),
      new RetryMiddleware(config.retryPolicy, options.metrics),
      new TimeoutMiddleware(config.timeoutMs, options.metrics),
      new LoggingMiddleware(this.logger),
      new AuditMiddleware(config.auditSink),
    ];
    this.terminalMiddleware = new AdapterExecutionMiddleware(
      options.resolver,
      options.metrics,
      options.eventPublisher,
    );
    this.pipeline = this.buildPipeline();
  }

  /** Registers an additional Middleware — always runs before the terminal Adapter-execution stage, in `use()` call order. */
  use(middleware: IWorkflowIntegrationMiddleware): this {
    this.extraMiddlewares.push(middleware);
    this.pipeline = this.buildPipeline();
    return this;
  }

  async integrate(
    namespace: IntegrationNamespace,
    request: IntegrationRequest,
    context: WorkflowIntegrationContext,
  ): Promise<IntegrateOutcome> {
    const mwContext = { context, namespace, request, metadata: {} as Record<string, unknown> };
    const outcome = await this.pipeline.execute(mwContext);
    const result: IntegrationResult = outcome.result ?? {
      success: false,
      error: `No result was produced for namespace "${namespace}"`,
    };
    return { context: withIntegrationResult(outcome.context, namespace, result), result };
  }

  private buildPipeline(): WorkflowIntegrationMiddleware {
    const pipeline = new WorkflowIntegrationMiddleware();
    for (const middleware of [
      ...this.baseMiddlewares,
      ...this.extraMiddlewares,
      this.terminalMiddleware,
    ]) {
      pipeline.use(middleware);
    }
    return pipeline;
  }
}
