import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeRetrievalExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-retrieval` — every concrete exception in this package extends this. */
export class KnowledgeRetrievalException extends AosError {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
