import type { CalendarEventDto } from "@/types/dashboard.types";

import { EVENT_ICON, STATUS_ICON, type CalendarEventType } from "./calendar.types";
import { formatEventTime } from "./calendar.utils";
import styles from "./EventRow.module.css";

export interface EventRowProps {
  readonly event: CalendarEventDto;
  /** `undefined` while a `run-now`/`skip` call for THIS row is in flight — disables its own action button only. */
  readonly pendingActionId?: string;
  readonly onRunNow: (id: string) => void;
}

function isSupportedType(value: string): value is CalendarEventType {
  return value in EVENT_ICON;
}

/** One event row inside "HARI INI"/"BESOK" (spec mockup's `EventRow`). */
export function EventRow({ event, pendingActionId, onRunNow }: EventRowProps): React.ReactElement {
  const icon = isSupportedType(event.eventType) ? EVENT_ICON[event.eventType] : "🗓";
  const statusIcon = STATUS_ICON[event.status] ?? "⏳";
  const isPending = pendingActionId === event.id;

  return (
    <div className={styles.row} data-testid="calendar-event-row">
      <span aria-hidden="true" className={styles.statusIcon}>
        {statusIcon}
      </span>
      <span className={styles.time}>{formatEventTime(event.scheduledAt)}</span>
      <div className={styles.body}>
        <p className={styles.title}>
          <span aria-hidden="true">{icon}</span> {event.title}
        </p>
        {event.status === "DONE" && event.result !== undefined ? (
          <p className={styles.resultSummary}>
            {event.result.summary}
            {event.durationMs !== undefined
              ? ` · ${String(Math.round(event.durationMs / 1000))}s`
              : ""}
          </p>
        ) : null}
        {event.status === "PENDING" && event.description !== undefined ? (
          <p className={styles.description}>{event.description}</p>
        ) : null}
        {event.status === "FAILED" ? (
          <p className={styles.errorMessage}>Gagal: {event.errorMessage ?? "unknown error"}</p>
        ) : null}
      </div>
      {event.status === "PENDING" ? (
        <button
          type="button"
          className={styles.runButton}
          disabled={isPending}
          onClick={() => onRunNow(event.id)}
        >
          ▶ Jalankan
        </button>
      ) : null}
      {event.status === "FAILED" ? (
        <button
          type="button"
          className={styles.retryButton}
          disabled={isPending}
          onClick={() => onRunNow(event.id)}
        >
          ↺ Ulang
        </button>
      ) : null}
    </div>
  );
}
