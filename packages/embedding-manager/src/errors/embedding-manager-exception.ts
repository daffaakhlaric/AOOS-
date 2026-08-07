import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface EmbeddingManagerExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/embedding-manager` — every concrete exception in this package extends this. */
export class EmbeddingManagerException extends AosError {
  constructor(message: string, options: EmbeddingManagerExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
