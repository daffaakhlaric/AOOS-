import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface WorkflowIntegrationExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/workflow-integration` — every concrete exception in this package extends this. */
export class WorkflowIntegrationException extends AosError {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
