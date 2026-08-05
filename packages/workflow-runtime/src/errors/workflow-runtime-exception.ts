import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface WorkflowRuntimeExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/workflow-runtime` — every concrete exception in this package extends this. */
export class WorkflowRuntimeException extends AosError {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
