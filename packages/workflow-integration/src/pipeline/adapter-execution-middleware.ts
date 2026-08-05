import { AdapterNotFoundException } from "../errors/adapter-not-found-exception.js";
import type { WorkflowIntegrationEventPublisher } from "../events/workflow-integration-event-publisher.js";
import { WorkflowIntegrationEventType } from "../events/workflow-integration-event-type.js";
import type { IWorkflowIntegrationMetrics } from "../metrics/i-workflow-integration-metrics.js";
import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "../middleware/i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "../middleware/workflow-integration-middleware-context.js";
import type { IWorkflowIntegrationResolver } from "../resolver/i-workflow-integration-resolver.js";
import type { IClock } from "../utils/i-clock.js";
import { SystemClock } from "../utils/i-clock.js";

/**
 * The terminal stage of `WorkflowIntegrationMiddleware`'s chain — resolves the target
 * Adapter (`WorkflowIntegrationResolver#resolve()` — "Only resolution.") and calls
 * `Adapter#execute()` exactly once (never itself implementing Capability/Tool/Connector/
 * Knowledge/Memory/Model/Agent/Prompt/Experience logic — "The package MUST execute
 * nothing." — this stage only forwards to whatever `IIntegrationAdapter` the Resolver
 * hands back). Never calls `next()` — this is always the last stage.
 */
export class AdapterExecutionMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "adapter-execution";

  constructor(
    private readonly resolver: IWorkflowIntegrationResolver,
    private readonly metrics: IWorkflowIntegrationMetrics,
    private readonly eventPublisher: WorkflowIntegrationEventPublisher,
    private readonly clock: IClock = new SystemClock(),
  ) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    _next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    const startedAt = this.clock.now();
    let adapter;
    try {
      adapter = this.resolver.resolve(mwContext.namespace);
    } catch (error) {
      if (error instanceof AdapterNotFoundException) {
        mwContext.result = { success: false, error: error.message };
        return;
      }
      throw error;
    }

    this.metrics.recordResolutionTime(this.clock.now() - startedAt);
    this.metrics.recordAdapterUsage(adapter.name);
    await this.eventPublisher.publishIntegrationEvent(
      WorkflowIntegrationEventType.ADAPTER_RESOLVED,
      mwContext.context,
      {
        namespace: mwContext.namespace,
        adapterName: adapter.name,
        adapterVersion: adapter.version,
      },
    );

    mwContext.result = await adapter.execute(mwContext.request);
  }
}
