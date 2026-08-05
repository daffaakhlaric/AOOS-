export interface TimerTickResult {
  readonly readyJobIds: readonly string[];
  readonly tickedAt: Date;
}

export interface ITimer {
  tick(): Promise<TimerTickResult>;
}
