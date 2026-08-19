"use client";

import { useCallback, useEffect, useState } from "react";

import type { CalendarEventDto } from "@/types/dashboard.types";

import { AddEventModal } from "./AddEventModal";
import { formatFullDayId, formatShortDayId, groupCalendarEvents } from "./calendar.utils";
import styles from "./CalendarWidget.module.css";
import { DaySection } from "./DaySection";
import { WeekSection } from "./WeekSection";

interface FetchState {
  readonly events?: readonly CalendarEventDto[];
  readonly error?: string;
}

async function fetchEvents(): Promise<readonly CalendarEventDto[]> {
  const response = await fetch("/api/calendar?range=this_week");
  const body = (await response.json().catch(() => ({}))) as {
    events?: readonly CalendarEventDto[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Gagal memuat kalender aktivitas.");
  }
  return body.events ?? [];
}

/**
 * "Kalender Aktivitas Tamara & Kai" (AAOS-KALENDER-AKTIVITAS) — embedded in the real Overview
 * page, `paling bawah` (after `<BranchSummary />`), never a standalone `/calendar` page (see
 * `docs/PROMPT-AAOS-KALENDER-AKTIVITAS.md`'s "SIDEBAR — TIDAK BERUBAH" section). Only the 5
 * event types `aaos-api`'s scheduler actually implements are ever offered by "Tambah Jadwal" —
 * see `calendar.types.ts`'s `CALENDAR_EVENT_TYPE_OPTIONS`.
 */
export function CalendarWidget(): React.ReactElement {
  const [state, setState] = useState<FetchState>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    fetchEvents()
      .then((events) => setState({ events }))
      .catch((caught: unknown) => {
        setState({ error: caught instanceof Error ? caught.message : "Gagal memuat kalender." });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRunNow(id: string): Promise<void> {
    setPendingActionId(id);
    try {
      const response = await fetch(`/api/calendar/${encodeURIComponent(id)}/run-now`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Gagal menjalankan jadwal.");
      }
      load();
    } finally {
      setPendingActionId(undefined);
    }
  }

  const now = new Date();
  const grouped = state.events !== undefined ? groupCalendarEvents(state.events, now) : undefined;

  return (
    <section className={styles.section} data-testid="calendar-widget">
      <div className={styles.header}>
        <p className={styles.title}>📅 Kalender Aktivitas</p>
        <button type="button" className={styles.addButton} onClick={() => setShowAddModal(true)}>
          + Tambah
        </button>
      </div>

      <div className={styles.body}>
        {state.error !== undefined ? (
          <p className={styles.error} data-testid="calendar-error">
            {state.error}
          </p>
        ) : grouped === undefined ? (
          <p className={styles.loading}>Memuat kalender aktivitas…</p>
        ) : (
          <>
            <DaySection
              label={`HARI INI — ${formatFullDayId(now)}`}
              events={grouped.today}
              {...(pendingActionId !== undefined ? { pendingActionId } : {})}
              onRunNow={(id) => void handleRunNow(id)}
              emptyLabel="Tidak ada jadwal hari ini."
            />
            {grouped.tomorrow.length > 0 ? (
              <DaySection
                label={`BESOK — ${formatShortDayId(new Date(now.getTime() + 24 * 60 * 60 * 1000))}`}
                events={grouped.tomorrow}
                {...(pendingActionId !== undefined ? { pendingActionId } : {})}
                onRunNow={(id) => void handleRunNow(id)}
              />
            ) : null}
            {grouped.restOfWeek.length > 0 ? <WeekSection events={grouped.restOfWeek} /> : null}
          </>
        )}
      </div>

      {showAddModal ? (
        <AddEventModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            load();
          }}
        />
      ) : null}
    </section>
  );
}
