/** A deterministic, manually-advanceable clock for tests — never wall-clock time. */
export class TestClock {
  private currentMs: number;

  constructor(startISO: string) {
    this.currentMs = new Date(startISO).getTime();
  }

  now = (): Date => new Date(this.currentMs);

  advanceMs(ms: number): void {
    this.currentMs += ms;
  }

  advanceDays(days: number): void {
    this.currentMs += days * 24 * 60 * 60 * 1000;
  }
}
