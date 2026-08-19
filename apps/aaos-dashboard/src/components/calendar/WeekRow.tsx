import type { CalendarEventDto } from "@/types/dashboard.types";

import { EVENT_ICON, type CalendarEventType } from "./calendar.types";
import { formatEventTime, formatWeekdayShort } from "./calendar.utils";
import styles from "./WeekSection.module.css";

function isSupportedType(value: string): value is CalendarEventType {
  return value in EVENT_ICON;
}

/** One compact row inside "MINGGU INI" (spec mockup's `WeekRow`). */
export function WeekRow({ event }: { readonly event: CalendarEventDto }): React.ReactElement {
  const icon = isSupportedType(event.eventType) ? EVENT_ICON[event.eventType] : "🗓";
  return (
    <div className={styles.weekRow}>
      <span className={styles.weekDay}>{formatWeekdayShort(event.scheduledAt)}</span>
      <span className={styles.weekTitle}>
        <span aria-hidden="true">{icon}</span> {event.title}
      </span>
      <span className={styles.weekTime}>{formatEventTime(event.scheduledAt)}</span>
    </div>
  );
}
