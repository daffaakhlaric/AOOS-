import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgePolicyExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-policy` — every concrete exception in this package extends this. */
export class KnowledgePolicyException extends AosError {
  constructor(message: string, options: KnowledgePolicyExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
