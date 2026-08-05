import { ErrorCode } from "@aos/common";

import { AosError, type AosErrorOptions } from "./aos-error.js";

export class ValidationError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

export class NotFoundError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.NOT_FOUND, message, options);
  }
}

export class UnauthorizedError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.UNAUTHORIZED, message, options);
  }
}

export class ForbiddenError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.FORBIDDEN, message, options);
  }
}

export class ConflictError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.CONFLICT, message, options);
  }
}

export class TimeoutError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.TIMEOUT, message, options);
  }
}

export class RateLimitedError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.RATE_LIMITED, message, options);
  }
}

export class UnavailableError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}

export class InternalError extends AosError {
  constructor(message: string, options?: AosErrorOptions) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
