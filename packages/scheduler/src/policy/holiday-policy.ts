import type { IHolidayProvider } from "../calendar/i-holiday-provider.js";
import { getLocalFields } from "../planner/timezone-fields.js";

import type { ISchedulerPolicy, PolicyContext, PolicyDecision } from "./i-scheduler-policy.js";

function toDateKey(date: Date, timezone: string): string {
  const local = getLocalFields(date, timezone);
  const month = String(local.month).padStart(2, "0");
  const day = String(local.day).padStart(2, "0");
  return `${local.year}-${month}-${day}`;
}

/** Holiday Policy — denies dispatch when the local calendar day is a holiday, per the injected `IHolidayProvider`. */
export class HolidayPolicy implements ISchedulerPolicy {
  readonly name = "holiday";

  constructor(
    private readonly holidayProvider: IHolidayProvider,
    private readonly timezone: string = "UTC",
  ) {}

  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    const dateKey = toDateKey(context.now, this.timezone);
    const isHoliday = await this.holidayProvider.isHoliday(dateKey);
    return isHoliday ? { allowed: false, reason: `${dateKey} is a holiday` } : { allowed: true };
  }
}
