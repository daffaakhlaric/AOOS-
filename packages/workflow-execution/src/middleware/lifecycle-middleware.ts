import { WorkflowExecutionException } from "../errors/workflow-execution-exception.js";
import { ExecutionState } from "../state-machine/execution-state.js";
import type { IExecutionStateMachine } from "../state-machine/i-execution-state-machine.js";

import type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "./i-execution-middleware.js";

type LifecycleOperation =
  | "initialize"
  | "start"
  | "pause"
  | "resume"
  | "retry"
  | "complete"
  | "fail"
  | "cancel"
  | "timeout"
  | "compensate";

const OPERATION_TARGET_STATE: Readonly<Record<LifecycleOperation, ExecutionState>> = {
  initialize: ExecutionState.READY,
  start: ExecutionState.RUNNING,
  pause: ExecutionState.PAUSED,
  resume: ExecutionState.RUNNING,
  retry: ExecutionState.RETRYING,
  complete: ExecutionState.COMPLETED,
  fail: ExecutionState.FAILED,
  cancel: ExecutionState.CANCELLED,
  timeout: ExecutionState.TIMEOUT,
  compensate: ExecutionState.COMPENSATING,
};

function isLifecycleOperation(value: string): value is LifecycleOperation {
  return value in OPERATION_TARGET_STATE;
}

/** Sixth (terminal) stage: performs the actual `IExecutionStateMachine` transition and writes the result back onto `context.session`. */
export class LifecycleMiddleware implements IExecutionMiddleware {
  readonly name = "lifecycle";

  constructor(private readonly stateMachine: IExecutionStateMachine) {}

  async execute(context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext): Promise<void> {
    if (!isLifecycleOperation(context.operation)) {
      throw new WorkflowExecutionException(
        `Unknown Execution lifecycle operation "${context.operation}"`,
      );
    }
    const reason =
      typeof context.metadata["reason"] === "string" ? context.metadata["reason"] : undefined;
    const nodeId =
      typeof context.metadata["nodeId"] === "string" ? context.metadata["nodeId"] : undefined;
    context.session = this.stateMachine.transition({
      session: context.session,
      to: OPERATION_TARGET_STATE[context.operation],
      nodeId,
      reason,
    });
    await next();
  }
}
