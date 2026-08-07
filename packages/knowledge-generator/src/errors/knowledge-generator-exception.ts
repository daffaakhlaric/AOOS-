import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeGeneratorExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-generator` — every concrete exception in this package extends this. */
export class KnowledgeGeneratorException extends AosError {
  constructor(message: string, options: KnowledgeGeneratorExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
