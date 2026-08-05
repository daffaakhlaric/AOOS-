/** A function that does nothing — useful as an explicit default callback. */
export function noop(): void {
  // intentionally empty
}

/** The identity function. */
export function identity<T>(value: T): T {
  return value;
}

/** True if value is neither null nor undefined (narrows the type accordingly). */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Exhaustiveness-check helper for `switch` statements over a closed union.
 * Calling this in a `default` branch makes the TypeScript compiler flag any
 * unhandled case at compile time.
 */
export function assertNever(value: never, message = "Unreachable case reached"): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

/** Clamp a number between a minimum and maximum, inclusive. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
