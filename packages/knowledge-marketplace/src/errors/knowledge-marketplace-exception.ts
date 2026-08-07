import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeMarketplaceExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-marketplace` — every concrete exception in this package extends this. */
export class KnowledgeMarketplaceException extends AosError {
  constructor(message: string, options: KnowledgeMarketplaceExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
