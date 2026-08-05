import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface KernelExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/**
 * Base class for every exception raised by the Runtime Kernel. Never thrown directly —
 * always via one of the concrete subclasses below, mirroring @aos/errors' own discipline
 * (Constitution §16 Error Handling Standards).
 */
export class KernelException extends AosError {
  constructor(message: string, options: KernelExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
