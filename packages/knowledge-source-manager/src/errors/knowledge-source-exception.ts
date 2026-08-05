import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeSourceExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-source-manager` — every concrete exception in this package extends this. */
export class KnowledgeSourceException extends AosError {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
