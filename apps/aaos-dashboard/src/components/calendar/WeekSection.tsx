import type { CalendarEventDto } from "@/types/dashboard.types";

import styles from "./WeekSection.module.css";
import { WeekRow } from "./WeekRow";

/** "MINGGU INI" section — the rest of `range=this_week`'s events, past today/tomorrow. */
export function WeekSection({
  events,
}: {
  readonly events: readonly CalendarEventDto[];
}): React.ReactElement {
  return (
    <div className={styles.section} data-testid="calendar-week-section">
      <p className={styles.label}>MINGGU INI</p>
      {events.map((event) => (
        <WeekRow key={event.id} event={event} />
      ))}
    </div>
  );
}
