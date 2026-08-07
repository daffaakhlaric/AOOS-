import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KnowledgeVersionExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/** Base exception for `@aos/knowledge-versioning` — every concrete exception in this package extends this. */
export class KnowledgeVersionException extends AosError {
  constructor(message: string, options: KnowledgeVersionExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
