import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface NodeRuntimeExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/node-runtime` — every concrete exception in this package extends this. */
export class NodeRuntimeException extends AosError {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
