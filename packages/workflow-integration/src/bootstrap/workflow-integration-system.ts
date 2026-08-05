import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { WorkflowIntegrationConfig } from "../config/workflow-integration-config.js";
import { WorkflowIntegrationEventPublisher } from "../events/workflow-integration-event-publisher.js";
import { WorkflowIntegration } from "../integration/workflow-integration.js";

/**
 * The Workflow Integration System — composition root wrapping `WorkflowIntegration` as a
 * Kernel Module, mirroring `@aos/workflow-execution`'s `WorkflowExecutionSystem`. Not yet
 * wired into any actual Kernel bootstrap call (no application does that in this
 * Engineering Task).
 */
export class WorkflowIntegrationSystem implements IModule {
  readonly name = "WorkflowIntegrationSystemModule";
  readonly version = "0.1.0";
  readonly integration: WorkflowIntegration;

  constructor(publisher: IPublisher, config?: WorkflowIntegrationConfig) {
    this.integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Integration façade is already constructed and ready to accept integrate() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
