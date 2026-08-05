import type { IClockProvider } from "./i-clock-provider.js";

/** The real wall clock — the only `IClockProvider` implementation that should ever run in production. */
export class SystemClock implements IClockProvider {
  now(): Date {
    return new Date();
  }
}
