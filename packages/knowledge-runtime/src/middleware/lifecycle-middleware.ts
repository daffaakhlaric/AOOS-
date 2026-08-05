import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import { RuntimeLifecycleException } from "../errors/runtime-lifecycle-exception.js";
import type { IKnowledgeRuntimeLifecycle } from "../lifecycle/i-lifecycle.js";

import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

export type LifecycleOperation =
  | "load"
  | "markLoaded"
  | "validate"
  | "markReady"
  | "start"
  | "suspend"
  | "resume"
  | "markResumed"
  | "complete"
  | "fail"
  | "cancel"
  | "expire"
  | "destroy";

const LIFECYCLE_OPERATIONS: ReadonlySet<string> = new Set<LifecycleOperation>([
  "load",
  "markLoaded",
  "validate",
  "markReady",
  "start",
  "suspend",
  "resume",
  "markResumed",
  "complete",
  "fail",
  "cancel",
  "expire",
  "destroy",
]);

function isLifecycleOperation(value: string): value is LifecycleOperation {
  return LIFECYCLE_OPERATIONS.has(value);
}

/** Seventh stage: performs the actual `IKnowledgeRuntimeLifecycle` transition and writes the result back onto `context.execution`. Every earlier middleware in the pipeline observed the pre-transition Execution. */
export class LifecycleMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "lifecycle";

  constructor(private readonly lifecycle: IKnowledgeRuntimeLifecycle) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    if (!isLifecycleOperation(context.operation)) {
      throw new RuntimeLifecycleException(`Unknown lifecycle operation "${context.operation}"`);
    }
    const reason =
      typeof context.metadata["reason"] === "string" ? context.metadata["reason"] : undefined;
    context.execution = this.applyOperation(context.operation, context.execution, reason);
    await next();
  }

  private applyOperation(
    operation: LifecycleOperation,
    execution: KnowledgeRuntimeExecution,
    reason: string | undefined,
  ): KnowledgeRuntimeExecution {
    switch (operation) {
      case "load":
        return this.lifecycle.load(execution);
      case "markLoaded":
        return this.lifecycle.markLoaded(execution);
      case "validate":
        return this.lifecycle.validate(execution);
      case "markReady":
        return this.lifecycle.markReady(execution);
      case "start":
        return this.lifecycle.start(execution);
      case "suspend":
        return this.lifecycle.suspend(execution, reason);
      case "resume":
        return this.lifecycle.resume(execution);
      case "markResumed":
        return this.lifecycle.markResumed(execution);
      case "complete":
        return this.lifecycle.complete(execution);
      case "fail":
        return this.lifecycle.fail(execution, reason);
      case "cancel":
        return this.lifecycle.cancel(execution, reason);
      case "expire":
        return this.lifecycle.expire(execution);
      case "destroy":
        return this.lifecycle.destroy(execution);
    }
  }
}
