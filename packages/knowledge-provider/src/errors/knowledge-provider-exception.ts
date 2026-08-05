import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeProviderExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-provider` — every concrete exception in this package extends this. */
export class KnowledgeProviderException extends AosError {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
