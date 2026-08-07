import type { Clock } from "../types/common.js";

/** Default clock: the real wall-clock time. */
export const systemClock: Clock = () => Date.now();

/** Builds a deterministic clock that always returns `timestamp`. Useful for tests. */
export function createFixedClock(timestamp: number): Clock {
  return () => timestamp;
}

/** Builds a deterministic clock that advances by `stepMs` on every call, starting at `startAt`. */
export function createSteppingClock(startAt: number, stepMs: number): Clock {
  let current = startAt - stepMs;
  return () => {
    current += stepMs;
    return current;
  };
}
