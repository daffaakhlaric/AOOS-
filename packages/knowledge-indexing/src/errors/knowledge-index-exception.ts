import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeIndexExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-indexing` — every concrete exception in this package extends this. */
export class KnowledgeIndexException extends AosError {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
