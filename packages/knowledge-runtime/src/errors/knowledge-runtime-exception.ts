import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeRuntimeExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-runtime` — every concrete exception in this package extends this. */
export class KnowledgeRuntimeException extends AosError {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
