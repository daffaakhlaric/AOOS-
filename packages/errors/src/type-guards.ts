import { AosError } from "./aos-error.js";

/** Type guard distinguishing an AosError (expected, coded) from an arbitrary thrown value. */
export function isAosError(value: unknown): value is AosError {
  return value instanceof AosError;
}

/** Normalizes any thrown value into an Error instance, for safe logging/rethrowing. */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === "string" ? value : JSON.stringify(value));
}
