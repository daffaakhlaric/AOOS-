import type { IPublisher } from "@aos/event-bus";
import type { NodeRuntime } from "@aos/node-runtime";
import type { IModule } from "@aos/runtime-kernel";
import type { WorkflowRuntime } from "@aos/workflow-runtime";

import type { WorkflowExecutionConfig } from "../config/workflow-execution-config.js";
import { WorkflowExecutionEngine } from "../engine/workflow-execution-engine.js";
import { ExecutionEventPublisher } from "../events/execution-event-publisher.js";

/**
 * The Workflow Execution System — composition root wrapping `WorkflowExecutionEngine` as
 * a Kernel Module, mirroring `@aos/workflow-runtime`'s `WorkflowRuntimeSystem` and
 * `@aos/node-runtime`'s `NodeRuntimeSystem`. Not yet wired into any actual Kernel
 * bootstrap call (no application does that in this Engineering Task).
 */
export class WorkflowExecutionSystem implements IModule {
  readonly name = "WorkflowExecutionSystemModule";
  readonly version = "0.1.0";
  readonly engine: WorkflowExecutionEngine;

  constructor(
    publisher: IPublisher,
    workflowRuntime: WorkflowRuntime,
    nodeRuntime: NodeRuntime,
    config?: WorkflowExecutionConfig,
  ) {
    this.engine = new WorkflowExecutionEngine({
      workflowRuntime,
      nodeRuntime,
      eventPublisher: new ExecutionEventPublisher(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Engine is already constructed and ready to accept executeWorkflow() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
