import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface RegistryExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/**
 * Base class for every exception raised by the Registry System. Never thrown directly —
 * always via one of the concrete subclasses below (Constitution §16 Error Handling Standards).
 */
export class RegistryException extends AosError {
  constructor(message: string, options: RegistryExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
