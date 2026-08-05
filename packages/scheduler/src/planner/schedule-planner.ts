import { ScheduleType } from "../contracts/schedule-type.js";
import type { Schedule } from "../contracts/schedule.js";

import { nextCronFireTime } from "./cron-next-fire.js";
import { parseCronExpression } from "./cron-parser.js";
import type { ISchedulePlanner, PlanningContext } from "./i-schedule-planner.js";
import { recurringToCron } from "./recurring-to-cron.js";

/** Computes the next fire time for every time-based Schedule kind — Dependency/Manual have none (see `ISchedulePlanner`). */
export class SchedulePlanner implements ISchedulePlanner {
  computeNextFireTime(schedule: Schedule, context: PlanningContext): Date | undefined {
    const floor = this.effectiveFloor(schedule, context.after);
    const candidate = this.computeRaw(schedule, { ...context, after: floor });
    return this.clampToWindow(schedule, candidate);
  }

  private computeRaw(schedule: Schedule, context: PlanningContext): Date | undefined {
    switch (schedule.type) {
      case ScheduleType.ONE_TIME:
        return context.lastFireAt
          ? undefined
          : this.afterOnly(new Date(schedule.fireAt), context.after);
      case ScheduleType.DELAYED: {
        if (context.lastFireAt) {
          return undefined;
        }
        const fireAt = new Date(context.createdAt.getTime() + schedule.delayMs);
        return this.afterOnly(fireAt, context.after);
      }
      case ScheduleType.INTERVAL: {
        const anchor = context.lastFireAt ?? context.createdAt;
        return new Date(anchor.getTime() + schedule.everyMs);
      }
      case ScheduleType.CALENDAR: {
        const upcoming = schedule.dates
          .map((iso) => new Date(iso))
          .filter((date) => date.getTime() > context.after.getTime())
          .sort((a, b) => a.getTime() - b.getTime());
        return upcoming[0];
      }
      case ScheduleType.CRON:
        return nextCronFireTime(
          parseCronExpression(schedule.expression),
          context.after,
          schedule.timezone,
        );
      case ScheduleType.RECURRING:
        return nextCronFireTime(recurringToCron(schedule), context.after, schedule.timezone);
      case ScheduleType.DEPENDENCY:
      case ScheduleType.MANUAL:
        return undefined;
    }
  }

  private afterOnly(candidate: Date, after: Date): Date | undefined {
    return candidate.getTime() > after.getTime() ? candidate : undefined;
  }

  private effectiveFloor(schedule: Schedule, after: Date): Date {
    if (!schedule.startAt) {
      return after;
    }
    const startAt = new Date(schedule.startAt);
    return startAt.getTime() - 1 > after.getTime() ? new Date(startAt.getTime() - 1) : after;
  }

  private clampToWindow(schedule: Schedule, candidate: Date | undefined): Date | undefined {
    if (!candidate || !schedule.endAt) {
      return candidate;
    }
    return candidate.getTime() <= new Date(schedule.endAt).getTime() ? candidate : undefined;
  }
}
