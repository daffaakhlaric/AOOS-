/**
 * Generic, cross-cutting error codes. Maps 1:1 to the base error classes in @aos/errors.
 * Domain-specific error codes (e.g. Lead-specific) are added by future domain packages,
 * never inserted here — this enum stays generic per Constitution §16 Error Handling Standards.
 */
export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  TIMEOUT = "TIMEOUT",
  RATE_LIMITED = "RATE_LIMITED",
  UNAVAILABLE = "UNAVAILABLE",
  INTERNAL = "INTERNAL",
}

/** Deployment environment — mirrors @aos/config's multi-environment support. */
export enum Environment {
  DEVELOPMENT = "development",
  TEST = "test",
  STAGING = "staging",
  PRODUCTION = "production",
}

/** Log severity levels — mirrors the Logging Contract's `severity` enum (docs/003.5 §17). */
export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}
