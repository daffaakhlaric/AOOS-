import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { WorkflowDefinitionConfig } from "../config/workflow-definition-config.js";
import { WorkflowDefinitionEventPublisher } from "../events/workflow-definition-event-publisher.js";

import { WorkflowDefinitionService } from "./workflow-definition-service.js";

/**
 * The Workflow Definition System — composition root wrapping `WorkflowDefinitionService`
 * as a Kernel Module, mirroring `@aos/scheduler`'s `SchedulerSystem` and `@aos/event-bus`'s
 * `EventBusSystem`. Implements `@aos/runtime-kernel`'s `IModule` so it can be registered
 * into a Kernel via `buildKernel({ modules: [workflowDefinitionSystem] })` — not yet wired
 * into any actual Kernel bootstrap call (no application does that in this Engineering
 * Task). Requires a live `@aos/event-bus` `IPublisher` — this package only defines and
 * registers Workflows, it never executes them.
 */
export class WorkflowDefinitionSystem implements IModule {
  readonly name = "WorkflowDefinitionSystemModule";
  readonly version = "0.1.0";
  readonly service: WorkflowDefinitionService;

  constructor(publisher: IPublisher, config: WorkflowDefinitionConfig = {}) {
    this.service = new WorkflowDefinitionService({
      eventPublisher: new WorkflowDefinitionEventPublisher(publisher),
      registry: config.registry,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Service is already constructed and ready to accept createDefinition()/validateDefinition() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
