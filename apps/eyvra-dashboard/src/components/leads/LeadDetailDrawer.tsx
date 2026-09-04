"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge, type BadgeType } from "@/components/ui/Badge";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateId, formatRelativeTimeId } from "@/lib/formatters";
import type { LeadDetailDto, LeadQualificationDto } from "@/types/dashboard.types";

import styles from "./LeadDetailDrawer.module.css";

const TEMPERATURE_BADGE_TYPE: Readonly<Record<string, BadgeType>> = {
  HOT: "HOT",
  WARM: "WARM",
  COLD: "COLD",
};

const QUALIFICATION_LABELS: Readonly<Record<keyof LeadQualificationDto, string>> = {
  budget: "Budget",
  unit: "Unit",
  area: "Area",
  payment: "Cara Bayar",
  timeline: "Timeline",
  name: "Nama",
};

export interface LeadDetailDrawerProps {
  readonly leadId: string;
  readonly onClose: () => void;
}

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 (PROMPT 4) — real lead detail drawer, opened by
 * `LeadPipelineBoard`'s card click. Fetches the SAME real `GET /api/leads/:id` endpoint
 * `aaos-api`'s `LeadDetailResponseDto` already backs (score, `qualification` — the real 6-boolean
 * scoring dimensions this domain actually tracks, used here as the spec's "score breakdown 6
 * dimensi" rather than fabricating 6 numeric sub-scores no real endpoint returns), plus its
 * embedded real `messages` array for a "5 pesan terakhir" preview.
 *
 * "Buka percakapan penuh" links to the real, full `ClaraInboxClient` (Leads hub's "Inbox" tab,
 * `?tab=inbox&lead=:id`) instead of re-implementing reply/takeover here — that flow already has
 * real send/claim/intervene logic this drawer would otherwise have to duplicate.
 *
 * "Handoff" intentionally links to the real "Semua Leads" tab (`ContactsClient`'s already-working
 * `POST /leads/:id/claim` "Assigned to" flow) instead of a second, parallel assign UI.
 */
export function LeadDetailDrawer({ leadId, onClose }: LeadDetailDrawerProps): React.ReactElement {
  const [detail, setDetail] = useState<LeadDetailDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setDetail(undefined);
    setError(undefined);
    fetch(`/api/leads/${leadId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat detail lead.");
        }
        return (await res.json()) as LeadDetailDto;
      })
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat detail lead.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div className={styles.overlay} data-testid="lead-detail-drawer" onClick={onClose}>
      <aside className={styles.drawer} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Tutup">
          ✕
        </button>
        {error !== undefined ? <ErrorCard message={error} /> : null}
        {error === undefined && detail === undefined ? <LoadingSpinner /> : null}
        {detail !== undefined ? (
          <>
            <div
              className={styles.header}
              style={{
                background:
                  detail.temperature === "HOT"
                    ? "linear-gradient(135deg, var(--v2-hot), var(--v2-blue))"
                    : detail.temperature === "WARM"
                      ? "linear-gradient(135deg, var(--v2-warm), var(--v2-blue))"
                      : "linear-gradient(135deg, var(--v2-cold), var(--v2-blue))",
              }}
            >
              <p className={styles.name}>{detail.leadName ?? detail.leadPhone}</p>
              <p className={styles.phone}>{detail.leadPhone}</p>
              <div className={styles.headerBadges}>
                <Badge type={TEMPERATURE_BADGE_TYPE[detail.temperature] ?? "COLD"} />
                <span className={styles.scoreRing}>{detail.score}</span>
              </div>
            </div>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Score Breakdown</h3>
              <ul className={styles.qualificationList}>
                {(Object.keys(QUALIFICATION_LABELS) as (keyof LeadQualificationDto)[]).map(
                  (key) => (
                    <li key={key} className={styles.qualificationItem}>
                      <span
                        className={detail.qualification[key] ? styles.qualOk : styles.qualMissing}
                      >
                        {detail.qualification[key] ? "✓" : "○"}
                      </span>
                      {QUALIFICATION_LABELS[key]}
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Percakapan Terakhir (5 pesan)</h3>
              {detail.messages.length === 0 ? (
                <p className={styles.empty}>Belum ada pesan.</p>
              ) : (
                <ul className={styles.messageList}>
                  {detail.messages.slice(-5).map((message) => (
                    <li key={message.id} className={styles.messageItem}>
                      <span className={styles.messageDirection}>
                        {message.direction === "INCOMING"
                          ? "Lead"
                          : (message.senderName ?? "Clara")}
                      </span>
                      <span className={styles.messageBody}>{message.body ?? "(tanpa teks)"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Timeline</h3>
              <p className={styles.timelineItem}>Masuk: {formatDateId(detail.createdAt)}</p>
              {detail.becameHotAt !== undefined ? (
                <p className={styles.timelineItem}>Jadi HOT: {formatDateId(detail.becameHotAt)}</p>
              ) : null}
              {detail.lastMessageAt !== undefined ? (
                <p className={styles.timelineItem}>
                  Pesan terakhir: {formatRelativeTimeId(detail.lastMessageAt)}
                </p>
              ) : null}
            </section>

            <div className={styles.actions}>
              <Link href={`/leads?tab=inbox&lead=${detail.id}`} className={styles.primaryAction}>
                Buka percakapan penuh
              </Link>
              <Link href="/leads?tab=semua" className={styles.secondaryAction}>
                Handoff
              </Link>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

export default LeadDetailDrawer;
