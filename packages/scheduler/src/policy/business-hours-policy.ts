import type { BusinessHoursConfig } from "../contracts/business-hours.js";
import { getLocalFields } from "../planner/timezone-fields.js";

import type { ISchedulerPolicy, PolicyContext, PolicyDecision } from "./i-scheduler-policy.js";

function toMinutes(hhmm: string): number {
  const [hourText, minuteText] = hhmm.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

/**
 * Business Hour Policy (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "BUSINESS HOURS":
 * Working Hour, Lunch Break, Weekend). "Belum implementasi penuh" — this is a real,
 * timezone-aware check against `BusinessHoursConfig`, but has no holiday-calendar
 * awareness (that's `HolidayPolicy`, evaluated separately).
 */
export class BusinessHoursPolicy implements ISchedulerPolicy {
  readonly name = "business-hours";

  constructor(private readonly config: BusinessHoursConfig) {}

  evaluate(context: PolicyContext): PolicyDecision {
    const local = getLocalFields(context.now, this.config.timezone);

    if (!this.config.workDays.includes(local.weekday)) {
      return { allowed: false, reason: "outside configured work days (weekend)" };
    }

    const minutesOfDay = local.hour * 60 + local.minute;
    const workStart = toMinutes(this.config.workStart);
    const workEnd = toMinutes(this.config.workEnd);
    if (minutesOfDay < workStart || minutesOfDay >= workEnd) {
      return { allowed: false, reason: "outside working hours" };
    }

    if (this.config.lunchStart && this.config.lunchEnd) {
      const lunchStart = toMinutes(this.config.lunchStart);
      const lunchEnd = toMinutes(this.config.lunchEnd);
      if (minutesOfDay >= lunchStart && minutesOfDay < lunchEnd) {
        return { allowed: false, reason: "during lunch break" };
      }
    }

    return { allowed: true };
  }
}
