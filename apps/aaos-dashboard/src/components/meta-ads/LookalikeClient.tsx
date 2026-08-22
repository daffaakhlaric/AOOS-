"use client";

import { useCallback, useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTimeIdWib, formatNumber } from "@/lib/formatters";
import type { LookalikeStatusDto, MetaAudienceDto } from "@/types/dashboard.types";

import styles from "./LookalikeClient.module.css";

const LOOKALIKE_PERCENTAGES = [1, 2, 3] as const;

function audienceTypeLabel(audienceType: string): string {
  switch (audienceType) {
    case "HOT_LEADS":
      return "Custom Audience — Hot Leads";
    case "LOOKALIKE_1PCT":
      return "Lookalike 1%";
    case "LOOKALIKE_2PCT":
      return "Lookalike 2%";
    case "LOOKALIKE_3PCT":
      return "Lookalike 3%";
    default:
      return audienceType;
  }
}

/**
 * `/meta-ads/lookalike` (AAOS-ABTESTING-LOOKALIKE Part 2) — hot-leads-based Lookalike Audience
 * page, backed by `aaos-api`'s real `lookalike` module via this app's own `/api/lookalike/*`
 * proxy routes.
 *
 * The spec's "Performa Lookalike vs Interest biasa" comparison table and Tamara's
 * "alihkan 60% budget" recommendation are deliberately NOT rendered here — there is no real,
 * already-tracked concept anywhere in this app's data model of which ad/ad set used Lookalike vs
 * Interest vs Broad targeting, so a comparison table would have to fabricate every row. Never
 * fabricated, per this codebase's established "no invented numbers" discipline (see
 * `AbTestingClient.tsx`'s own "BUDGET DIHEMAT" KPI deviation note for the same precedent). Every
 * number this page DOES show — hot lead counts, audience size, sync timestamps — is real, pulled
 * from `LookalikeService`'s own real `getStatus`/`listAudiences`.
 */
export function LookalikeClient(): React.ReactElement {
  const [status, setStatus] = useState<LookalikeStatusDto | undefined>(undefined);
  const [audiences, setAudiences] = useState<readonly MetaAudienceDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const [creatingPercentage, setCreatingPercentage] = useState<number | undefined>(undefined);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/lookalike/status").then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat status hot leads.");
        }
        return (await res.json()) as { status: LookalikeStatusDto };
      }),
      fetch("/api/lookalike/audiences").then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat daftar audience.");
        }
        return (await res.json()) as { audiences: readonly MetaAudienceDto[] };
      }),
    ])
      .then(([statusBody, audiencesBody]) => {
        setStatus(statusBody.status);
        setAudiences(audiencesBody.audiences);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat data Lookalike.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync(): Promise<void> {
    setSyncing(true);
    try {
      const response = await fetch("/api/lookalike/sync", { method: "POST" });
      if (response.ok) {
        load();
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreateLookalike(percentage: 1 | 2 | 3): Promise<void> {
    setCreatingPercentage(percentage);
    try {
      const response = await fetch("/api/lookalike/audiences/lookalike", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ percentage }),
      });
      if (response.ok) {
        load();
      }
    } finally {
      setCreatingPercentage(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  if (status === undefined || audiences === undefined) {
    return <LoadingSpinner />;
  }

  const customAudience = audiences.find((a) => a.audienceType === "HOT_LEADS");
  const lookalikeByPercentage = new Map(
    audiences
      .filter((a) => a.audienceType.startsWith("LOOKALIKE_"))
      .map((a) => [a.percentage, a] as const),
  );

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Lookalike Audience</h2>
          <p className={styles.subtitle}>Hot leads Anda jadi basis Lookalike di Meta Ads</p>
        </div>
      </div>

      <div className={styles.card} data-testid="lookalike-status-card">
        <p className={styles.cardTitle}>📊 Hot Leads Database</p>
        <div className={styles.statRow}>
          <p>
            Total hot leads: <strong>{formatNumber(status.totalHotLeads)} leads</strong>
          </p>
          <p>
            Di Meta Audience: <strong>{formatNumber(status.syncedToMetaAudience)} leads</strong>
            {status.lastSyncedAt !== undefined
              ? ` (terakhir sync ${formatDateTimeIdWib(status.lastSyncedAt)})`
              : ""}
          </p>
          <p>
            Min untuk aktif: <strong>{formatNumber(status.minRequiredForLookalike)} leads</strong>
            {status.lookalikeEligible
              ? ""
              : ` (butuh ${formatNumber(Math.max(0, status.minRequiredForLookalike - status.totalHotLeads))} lagi)`}
          </p>
        </div>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={status.progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${String(status.progressPercentage)}%` }}
          />
        </div>
        <p className={styles.progressLabel}>
          Progress: {formatNumber(status.totalHotLeads)}/
          {formatNumber(status.minRequiredForLookalike)}
        </p>

        {!status.lookalikeEligible ? (
          <p className={styles.warningNote}>
            ⚠ Meta membutuhkan minimal {formatNumber(status.minRequiredForLookalike)} orang di
            custom audience sebelum bisa generate Lookalike. Terus jalankan Jessy untuk kumpulkan
            lebih banyak!
          </p>
        ) : null}

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={syncing}
            onClick={() => void handleSync()}
          >
            {syncing ? "Mem-sync..." : "🔄 Sync Hot Leads ke Meta"}
          </button>
        </div>
      </div>

      {customAudience !== undefined ? (
        <div className={styles.card} data-testid="lookalike-audience-card">
          <p className={styles.cardTitle}>✅ Custom Audience Aktif</p>
          <div className={styles.statRow}>
            <p>
              Nama: <strong>{customAudience.name}</strong>
            </p>
            <p>
              Size:{" "}
              <strong>
                {customAudience.size !== undefined ? formatNumber(customAudience.size) : "—"} orang
              </strong>
            </p>
            {customAudience.lastUpdatedAt !== undefined ? (
              <p>
                Update: <strong>{formatDateTimeIdWib(customAudience.lastUpdatedAt)}</strong>
              </p>
            ) : null}
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Lookalike Audiences</p>
            <div className={styles.audienceList} data-testid="lookalike-audience-list">
              {LOOKALIKE_PERCENTAGES.map((percentage) => {
                const existing = lookalikeByPercentage.get(percentage);
                return (
                  <div key={percentage} className={styles.audienceRow}>
                    <div className={styles.audienceMeta}>
                      <p className={styles.audienceName}>
                        {audienceTypeLabel(`LOOKALIKE_${String(percentage)}PCT`)}
                      </p>
                      <p className={styles.audienceDetail}>
                        {existing !== undefined
                          ? `Meta ID: ${existing.metaAudienceId}`
                          : "Belum dibuat"}
                      </p>
                    </div>
                    {existing !== undefined ? (
                      <span className={`${styles.audienceStatus} ${styles.audienceStatusActive}`}>
                        ✅ AKTIF
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.linkButton}
                        disabled={!status.lookalikeEligible || creatingPercentage === percentage}
                        onClick={() => void handleCreateLookalike(percentage)}
                      >
                        {creatingPercentage === percentage
                          ? "Membuat..."
                          : `+ Buat Lookalike ${String(percentage)}%`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
