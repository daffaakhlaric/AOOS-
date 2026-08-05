/**
 * Clock port (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "CLOCK"). Every time-dependent
 * component (planner, timer, retry, policy) reads time through this port, never through
 * `Date.now()`/`new Date()` directly — that's what makes `MockClock` possible, and it's the
 * seam a future Simulation Clock ("Belum membuat Simulation Clock") would plug into without
 * touching any consumer.
 */
export interface IClockProvider {
  now(): Date;
}
