import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";
import type { IWorkflowDefinitionRegistry } from "@aos/workflow-definition";

import type { WorkflowRuntimeConfig } from "../config/workflow-runtime-config.js";
import { WorkflowRuntimeEventPublisher } from "../events/workflow-runtime-event-publisher.js";
import { WorkflowRuntime } from "../runtime/workflow-runtime.js";

/**
 * The Workflow Runtime System — composition root wrapping `WorkflowRuntime` as a Kernel
 * Module, mirroring `@aos/workflow-definition`'s `WorkflowDefinitionSystem` and
 * `@aos/scheduler`'s `SchedulerSystem`. Not yet wired into any actual Kernel bootstrap call
 * (no application does that in this Engineering Task).
 */
export class WorkflowRuntimeSystem implements IModule {
  readonly name = "WorkflowRuntimeSystemModule";
  readonly version = "0.1.0";
  readonly runtime: WorkflowRuntime;

  constructor(
    publisher: IPublisher,
    definitionRegistry: IWorkflowDefinitionRegistry,
    config?: WorkflowRuntimeConfig,
  ) {
    this.runtime = new WorkflowRuntime({
      definitionRegistry,
      eventPublisher: new WorkflowRuntimeEventPublisher(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Runtime is already constructed and ready to accept createInstance()/lifecycle calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
