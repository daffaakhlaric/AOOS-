/** A deterministic, manually-advanceable clock for tests — never wall-clock time. */
export class TestClock {
  private currentMs: number;

  constructor(startISO: string) {
    this.currentMs = new Date(startISO).getTime();
  }

  now = (): number => this.currentMs;

  nowDate = (): Date => new Date(this.currentMs);

  advanceMs(ms: number): void {
    this.currentMs += ms;
  }
}
