/** A minimal, testable time source — Timeout checks and Retry backoff scheduling read `now()` through this rather than calling `Date.now()` directly. */
export interface IClock {
  now(): number;
}

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}
