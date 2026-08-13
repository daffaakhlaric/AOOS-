import type { Result } from "@aos/common";

/** Unwraps a `Result`'s success value, failing the test loudly (not silently) if it's an error. Mirrors `@aos/ai-judge`'s own test helper of the same name. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(
      `Expected ok Result, got error: ${String((result.error as { message?: string })?.message ?? result.error)}`,
    );
  }
  return result.value;
}

/** Unwraps a `Result`'s error, failing the test loudly if it's unexpectedly ok. */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (result.ok) {
    throw new Error("Expected error Result, got ok");
  }
  return result.error;
}
