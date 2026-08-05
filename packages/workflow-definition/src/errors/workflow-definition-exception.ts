import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface WorkflowDefinitionExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/**
 * Base class for every exception raised by AOS-WDL. Never thrown directly — always via
 * one of the concrete subclasses below (Constitution §16 Error Handling Standards).
 */
export class WorkflowDefinitionException extends AosError {
  constructor(message: string, options: WorkflowDefinitionExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
