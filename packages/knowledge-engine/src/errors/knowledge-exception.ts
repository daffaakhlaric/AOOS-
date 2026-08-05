import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-engine` — every concrete exception in this package extends this. */
export class KnowledgeException extends AosError {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
