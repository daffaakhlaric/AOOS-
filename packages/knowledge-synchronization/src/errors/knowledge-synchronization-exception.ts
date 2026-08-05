import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeSynchronizationExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-synchronization` — every concrete exception in this package extends this. */
export class KnowledgeSynchronizationException extends AosError {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
