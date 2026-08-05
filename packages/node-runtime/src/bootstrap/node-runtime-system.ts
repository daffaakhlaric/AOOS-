import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { NodeRuntimeConfig } from "../config/node-runtime-config.js";
import { NodeRuntimeEventPublisher } from "../events/node-runtime-event-publisher.js";
import { NodeRuntime } from "../runtime/node-runtime.js";

/**
 * The Node Runtime System — composition root wrapping `NodeRuntime` as a Kernel Module,
 * mirroring `@aos/workflow-runtime`'s `WorkflowRuntimeSystem`. Not yet wired into any
 * actual Kernel bootstrap call (no application does that in this Engineering Task).
 */
export class NodeRuntimeSystem implements IModule {
  readonly name = "NodeRuntimeSystemModule";
  readonly version = "0.1.0";
  readonly runtime: NodeRuntime;

  constructor(publisher: IPublisher, config?: NodeRuntimeConfig) {
    this.runtime = new NodeRuntime({
      eventPublisher: new NodeRuntimeEventPublisher(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Runtime is already constructed and ready to accept createFromDefinition()/lifecycle calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
