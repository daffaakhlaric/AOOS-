import type { ErrorCode } from "@aos/common";

export interface AosErrorContext {
  readonly tenantId?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly [key: string]: unknown;
}

export interface AosErrorOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/**
 * Base error class for every AOS error. Never thrown directly — always via one of the
 * concrete subclasses in specific-errors.ts, per Constitution §16 Error Handling Standards
 * (every error must carry a stable machine-readable code and enough context to reconstruct
 * what happened without replaying the original call).
 */
export class AosError extends Error {
  public readonly code: ErrorCode;
  public readonly context: AosErrorContext | undefined;

  constructor(code: ErrorCode, message: string, options: AosErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.context = options.context;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** A structured, log-safe representation — never includes raw PII by construction (fields are caller-supplied). */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}
