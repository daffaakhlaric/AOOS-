/** Discriminant for the four scheduling kinds the scheduler supports. */
export enum ScheduleKind {
  Immediate = "immediate",
  Scheduled = "scheduled",
  Interval = "interval",
  Cron = "cron",
}

/** Run exactly once, as soon as the scheduler next processes due jobs. */
export interface ImmediateSchedule {
  readonly kind: ScheduleKind.Immediate;
}

/** Run exactly once, at (or after) a fixed epoch-millisecond timestamp. */
export interface ScheduledSchedule {
  readonly kind: ScheduleKind.Scheduled;
  readonly runAt: number;
}

/** Run repeatedly, every `intervalMs`, starting at `startAt` (defaults to registration time). */
export interface IntervalSchedule {
  readonly kind: ScheduleKind.Interval;
  readonly intervalMs: number;
  readonly startAt: number;
}

/** Run repeatedly, according to a 5-field cron-subset expression (see `utils/cron.ts`). */
export interface CronSchedule {
  readonly kind: ScheduleKind.Cron;
  readonly expression: string;
}

export type ScheduleDescriptor =
  ImmediateSchedule | ScheduledSchedule | IntervalSchedule | CronSchedule;
