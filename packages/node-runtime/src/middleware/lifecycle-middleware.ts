import { NodeLifecycleException } from "../errors/node-lifecycle-exception.js";
import type { NodeExecution } from "../instance/node-execution.js";
import type { INodeLifecycleManager } from "../lifecycle/i-node-lifecycle-manager.js";

import type {
  INodeMiddleware,
  NodeMiddlewareContext,
  NodeMiddlewareNext,
} from "./i-node-middleware.js";

type LifecycleOperation =
  | "initialize"
  | "validate"
  | "prepare"
  | "start"
  | "pause"
  | "resume"
  | "complete"
  | "fail"
  | "cancel"
  | "timeout";

const LIFECYCLE_OPERATIONS: ReadonlySet<string> = new Set<LifecycleOperation>([
  "initialize",
  "validate",
  "prepare",
  "start",
  "pause",
  "resume",
  "complete",
  "fail",
  "cancel",
  "timeout",
]);

function isLifecycleOperation(value: string): value is LifecycleOperation {
  return LIFECYCLE_OPERATIONS.has(value);
}

/**
 * Sixth (terminal) stage: performs the actual `INodeLifecycleManager` operation and
 * writes the result back onto `context.execution`. Every earlier middleware in the
 * pipeline observed the pre-transition Execution.
 */
export class LifecycleMiddleware implements INodeMiddleware {
  readonly name = "lifecycle";

  constructor(private readonly lifecycleManager: INodeLifecycleManager) {}

  async execute(context: NodeMiddlewareContext, next: NodeMiddlewareNext): Promise<void> {
    if (!isLifecycleOperation(context.operation)) {
      throw new NodeLifecycleException(`Unknown Node lifecycle operation "${context.operation}"`);
    }
    const reason =
      typeof context.metadata["reason"] === "string" ? context.metadata["reason"] : undefined;
    context.execution = this.applyOperation(context.operation, context.execution, reason);
    await next();
  }

  private applyOperation(
    operation: LifecycleOperation,
    execution: NodeExecution,
    reason: string | undefined,
  ): NodeExecution {
    switch (operation) {
      case "initialize":
        return this.lifecycleManager.initialize(execution);
      case "validate":
        return this.lifecycleManager.validate(execution);
      case "prepare":
        return this.lifecycleManager.prepare(execution);
      case "start":
        return this.lifecycleManager.start(execution);
      case "pause":
        return this.lifecycleManager.pause(execution, reason);
      case "resume":
        return this.lifecycleManager.resume(execution);
      case "complete":
        return this.lifecycleManager.complete(execution);
      case "fail":
        return this.lifecycleManager.fail(execution, reason);
      case "cancel":
        return this.lifecycleManager.cancel(execution, reason);
      case "timeout":
        return this.lifecycleManager.timeout(execution);
    }
  }
}
