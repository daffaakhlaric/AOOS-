import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeValidatorExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-validator` — every concrete exception in this package extends this. */
export class KnowledgeValidatorException extends AosError {
  constructor(message: string, options: KnowledgeValidatorExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
