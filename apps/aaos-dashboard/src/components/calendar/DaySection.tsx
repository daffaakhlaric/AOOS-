import type { CalendarEventDto } from "@/types/dashboard.types";

import styles from "./DaySection.module.css";
import { EventRow } from "./EventRow";

export interface DaySectionProps {
  readonly label: string;
  readonly events: readonly CalendarEventDto[];
  readonly pendingActionId?: string;
  readonly onRunNow: (id: string) => void;
  readonly emptyLabel?: string;
}

/** "HARI INI —"/"BESOK —" section (spec mockup's `DaySection`). */
export function DaySection({
  label,
  events,
  pendingActionId,
  onRunNow,
  emptyLabel,
}: DaySectionProps): React.ReactElement {
  return (
    <div className={styles.section} data-testid="calendar-day-section">
      <p className={styles.label}>{label}</p>
      {events.length === 0 ? (
        emptyLabel !== undefined ? (
          <p className={styles.empty}>{emptyLabel}</p>
        ) : null
      ) : (
        events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            {...(pendingActionId !== undefined ? { pendingActionId } : {})}
            onRunNow={onRunNow}
          />
        ))
      )}
    </div>
  );
}
