import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeQualityExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-quality` — every concrete exception in this package extends this. */
export class KnowledgeQualityException extends AosError {
  constructor(message: string, options: KnowledgeQualityExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
