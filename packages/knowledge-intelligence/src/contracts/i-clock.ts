/**
 * Injectable clock contract. All freshness/staleness/risk/report timestamping logic in this
 * package depends on `IClock.now()` via constructor injection instead of calling `Date.now()`
 * directly, keeping every scoring computation synchronous, deterministic, and reproducible.
 */
export interface IClock {
  /** Current time as epoch milliseconds. */
  now(): number;
}
