import type { IClockProvider } from "./i-clock-provider.js";

/** A deterministic, manually-advanced clock — the backbone of every Clock/Timer/Retry/Schedule Test in this package. */
export class MockClock implements IClockProvider {
  private current: Date;

  constructor(initial: Date | string = new Date(0)) {
    this.current = typeof initial === "string" ? new Date(initial) : initial;
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(value: Date | string): void {
    this.current = typeof value === "string" ? new Date(value) : value;
  }

  advanceMs(deltaMs: number): void {
    this.current = new Date(this.current.getTime() + deltaMs);
  }
}
