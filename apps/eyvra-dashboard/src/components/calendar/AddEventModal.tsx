"use client";

import { useState } from "react";

import {
  CALENDAR_EVENT_TYPE_OPTIONS,
  DAY_LABELS,
  EVENT_TYPE_LABEL,
  RECURRENCE_LABEL,
  TIME_PRESETS,
  type CalendarEventType,
  type CalendarRecurrence,
} from "./calendar.types";
import styles from "./AddEventModal.module.css";

export interface AddEventModalProps {
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

const RECURRENCE_OPTIONS: readonly CalendarRecurrence[] = ["ONCE", "DAILY", "WEEKLY", "MONTHLY"];

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function toggleDay(days: readonly number[], day: number): readonly number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/** "+ Tambah Jadwal" modal (spec mockup's `AddEventModal`) — a lightweight overlay over Overview, never a page navigation. */
export function AddEventModal({ onClose, onSaved }: AddEventModalProps): React.ReactElement {
  const [eventType, setEventType] = useState<CalendarEventType>("SAMANTHA_ANALYZE");
  const [date, setDate] = useState(todayDateInputValue());
  const [time, setTime] = useState("06:00");
  const [recurrence, setRecurrence] = useState<CalendarRecurrence>("ONCE");
  const [recurrenceDays, setRecurrenceDays] = useState<readonly number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSave(): Promise<void> {
    if (recurrence === "WEEKLY" && recurrenceDays.length === 0) {
      setError("Pilih minimal satu hari untuk jadwal mingguan.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType,
          title: EVENT_TYPE_LABEL[eventType],
          scheduledAt: `${date}T${time}:00+07:00`,
          recurrence,
          ...(recurrence === "WEEKLY" ? { recurrenceDays, recurrenceTime: time } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menyimpan jadwal.");
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan jadwal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Tambah Jadwal">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>+ Tambah Jadwal</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label htmlFor="calendar-event-type" className={styles.formLabel}>
              Tipe Aktivitas
            </label>
            <select
              id="calendar-event-type"
              className={styles.formInput}
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CalendarEventType)}
            >
              {CALENDAR_EVENT_TYPE_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="calendar-date" className={styles.formLabel}>
              Tanggal &amp; Jam
            </label>
            <div className={styles.dateTimeRow}>
              <input
                id="calendar-date"
                type="date"
                className={styles.formInput}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                aria-label="Jam"
                type="time"
                className={styles.timeInput}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className={styles.presetRow}>
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTime(preset)}
                  className={`${styles.presetButton} ${time === preset ? styles.presetButtonActive : ""}`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Berulang</span>
            <div className={styles.recurrenceRow}>
              {RECURRENCE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRecurrence(option)}
                  className={`${styles.recurrenceButton} ${recurrence === option ? styles.recurrenceButtonActive : ""}`}
                >
                  {RECURRENCE_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          {recurrence === "WEEKLY" ? (
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Hari</span>
              <div className={styles.dayRow}>
                {DAY_LABELS.map((label, index) => {
                  const day = index + 1;
                  const active = recurrenceDays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setRecurrenceDays((current) => toggleDay(current, day))}
                      className={`${styles.dayButton} ${active ? styles.dayButtonActive : ""}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "✓ Simpan Jadwal"}
          </button>
        </div>
      </div>
    </div>
  );
}
