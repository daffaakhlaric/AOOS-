import { LifecycleException } from "../errors/lifecycle-exception.js";
import type { WorkflowExecution } from "../instance/workflow-execution.js";
import type { IWorkflowLifecycleManager } from "../lifecycle/i-lifecycle-manager.js";

import type {
  IRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

type LifecycleOperation =
  "initialize" | "start" | "pause" | "resume" | "cancel" | "expire" | "complete" | "fail";

const LIFECYCLE_OPERATIONS: ReadonlySet<string> = new Set<LifecycleOperation>([
  "initialize",
  "start",
  "pause",
  "resume",
  "cancel",
  "expire",
  "complete",
  "fail",
]);

function isLifecycleOperation(value: string): value is LifecycleOperation {
  return LIFECYCLE_OPERATIONS.has(value);
}

/**
 * Fifth (terminal) stage: performs the actual `IWorkflowLifecycleManager` transition and
 * writes the result back onto `context.execution`. Every earlier middleware in the
 * pipeline observed the pre-transition Execution.
 */
export class LifecycleMiddleware implements IRuntimeMiddleware {
  readonly name = "lifecycle";

  constructor(private readonly lifecycleManager: IWorkflowLifecycleManager) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    if (!isLifecycleOperation(context.operation)) {
      throw new LifecycleException(`Unknown lifecycle operation "${context.operation}"`);
    }
    const reason =
      typeof context.metadata["reason"] === "string" ? context.metadata["reason"] : undefined;
    context.execution = this.applyOperation(context.operation, context.execution, reason);
    await next();
  }

  private applyOperation(
    operation: LifecycleOperation,
    execution: WorkflowExecution,
    reason: string | undefined,
  ): WorkflowExecution {
    switch (operation) {
      case "initialize":
        return this.lifecycleManager.initialize(execution);
      case "start":
        return this.lifecycleManager.start(execution);
      case "pause":
        return this.lifecycleManager.pause(execution, reason);
      case "resume":
        return this.lifecycleManager.resume(execution);
      case "cancel":
        return this.lifecycleManager.cancel(execution, reason);
      case "expire":
        return this.lifecycleManager.expire(execution);
      case "complete":
        return this.lifecycleManager.complete(execution);
      case "fail":
        return this.lifecycleManager.fail(execution, reason);
    }
  }
}
