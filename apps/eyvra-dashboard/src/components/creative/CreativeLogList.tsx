"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTimeIdWib } from "@/lib/formatters";
import type { CreativeLogDto } from "@/types/dashboard.types";

import styles from "./CreativeLogList.module.css";

/** The REAL `creative_logs.event_type` values the pipeline writes — no filter offers a value nothing produces. */
const EVENT_FILTERS = [
  { key: undefined, label: "Semua" },
  { key: "BRIEF_SENT", label: "Brief" },
  { key: "GENERATE", label: "Generate" },
  { key: "COMPLETE", label: "Selesai" },
  { key: "ERROR", label: "Error" },
  { key: "APPROVED", label: "Approve" },
  { key: "REJECTED", label: "Reject" },
] as const;

const PERIODS = [
  { hours: 24, label: "Hari ini" },
  { hours: 168, label: "7 hari" },
  { hours: 720, label: "30 hari" },
  { hours: undefined, label: "Semua" },
] as const;

const EVENT_ICON: Readonly<Record<string, string>> = {
  BRIEF_SENT: "🤖",
  GENERATE: "🎨",
  COMPLETE: "✅",
  ERROR: "❌",
  APPROVED: "👤",
  REJECTED: "👤",
};

/**
 * "Log Samantha × Kai" — the real, append-only `creative_logs` audit trail.
 *
 * Every row rendered here is a row the pipeline actually wrote at the moment the thing happened: a
 * brief really handed to Kai, a real Kie AI run really starting/finishing, a real error, a real
 * human decision. Nothing on this screen is synthesised, reconstructed, or narrated — if a step
 * did not happen, there is no line for it.
 */
export function CreativeLogList(): React.ReactElement {
  const [eventType, setEventType] = useState<string | undefined>(undefined);
  const [sinceHours, setSinceHours] = useState<number | undefined>(168);
  const [logs, setLogs] = useState<readonly CreativeLogDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    setLogs(undefined);
    setError(undefined);
    const params = new URLSearchParams({ limit: "200" });
    if (eventType !== undefined) params.set("eventType", eventType);
    if (sinceHours !== undefined) params.set("sinceHours", String(sinceHours));
    try {
      const res = await fetch(`/api/creative/logs?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Gagal memuat log koordinasi.");
      }
      const body = (await res.json()) as { logs: readonly CreativeLogDto[] };
      setLogs(body.logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat log koordinasi.");
    }
  }, [eventType, sinceHours]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.wrapper}>
      <section className={styles.toolbar}>
        <div className={styles.filterRow}>
          {EVENT_FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-pressed={eventType === filter.key}
              className={
                eventType === filter.key ? `${styles.chip} ${styles.chipActive}` : styles.chip
              }
              onClick={() => setEventType(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          {PERIODS.map((period) => (
            <button
              key={period.label}
              type="button"
              aria-pressed={sinceHours === period.hours}
              className={
                sinceHours === period.hours ? `${styles.chip} ${styles.chipActive}` : styles.chip
              }
              onClick={() => setSinceHours(period.hours)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </section>

      {error !== undefined ? <ErrorCard message={error} /> : null}
      {logs === undefined && error === undefined ? <LoadingSpinner /> : null}
      {logs !== undefined && logs.length === 0 ? (
        <EmptyState
          title="Belum ada log"
          description="Log terisi otomatis begitu ada brief yang dikirim ke Kai, hasil generate, atau keputusan approve/reject."
        />
      ) : null}

      {(logs ?? []).map((entry) => (
        <article key={entry.id} data-testid="creative-log-entry" className={styles.entry}>
          <p className={styles.entryTime}>{formatDateTimeIdWib(entry.createdAt)}</p>
          <p className={styles.entryHeader}>
            <span className={styles.entryIcon}>{EVENT_ICON[entry.eventType] ?? "•"}</span>
            {entry.fromAgent}
            {entry.toAgent !== undefined ? ` → ${entry.toAgent}` : ""}
            <span className={styles.eventBadge}>{entry.eventType}</span>
          </p>
          <p className={styles.entryMessage}>{entry.message}</p>
          {entry.stableId !== undefined ? (
            <p className={styles.entryMeta}>Iklan #{entry.stableId}</p>
          ) : null}
          {entry.error !== undefined ? <p className={styles.entryError}>{entry.error}</p> : null}
          {entry.brief !== undefined ? (
            <details className={styles.details}>
              <summary>Lihat brief lengkap</summary>
              <pre className={styles.pre}>{JSON.stringify(entry.brief, null, 2)}</pre>
            </details>
          ) : null}
          {entry.result !== undefined ? (
            <details className={styles.details}>
              <summary>Lihat hasil generate</summary>
              <pre className={styles.pre}>{JSON.stringify(entry.result, null, 2)}</pre>
            </details>
          ) : null}
          {entry.metadata !== undefined ? (
            <details className={styles.details}>
              <summary>Detail teknis</summary>
              <pre className={styles.pre}>{JSON.stringify(entry.metadata, null, 2)}</pre>
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
}
