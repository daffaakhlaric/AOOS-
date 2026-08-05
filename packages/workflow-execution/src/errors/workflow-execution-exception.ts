import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface WorkflowExecutionExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/workflow-execution` — every concrete exception in this package extends this. */
export class WorkflowExecutionException extends AosError {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
