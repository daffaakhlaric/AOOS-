"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CreativePackageCard } from "@/components/creative/CreativePackageCard";
import { CreativeLogList } from "@/components/creative/CreativeLogList";
import { ManualBriefForm } from "@/components/creative/ManualBriefForm";
import { PropertyManualBriefForm } from "@/components/creative/PropertyManualBriefForm";
import { SamanthaRecommendations } from "@/components/creative/SamanthaRecommendations";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatDateTimeIdWib } from "@/lib/formatters";
import type { CreativePackageDto } from "@/types/dashboard.types";
import type { Vertical } from "@/types/tenant.types";

import styles from "./CreativeClient.module.css";

/**
 * How often the "Sedang Diproses" tab re-reads the real persisted package state. Polling, not
 * Supabase Realtime: this codebase has no Realtime precedent, and the source of truth is the
 * `creative_packages` row `aaos-api` writes, which any replica can serve.
 */
const POLL_INTERVAL_MS = 5000;

const TABS = [
  { key: "REVIEW", label: "Antrian Review" },
  { key: "PROCESSING", label: "Sedang Diproses" },
  { key: "MANUAL", label: "Buat Manual" },
  { key: "SAMANTHA", label: "Rekomendasi Samantha" },
  { key: "LOG", label: "Log Samantha × Kai" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function isThisMonth(iso: string | undefined, now: Date): boolean {
  if (iso === undefined) return false;
  const date = new Date(iso);
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

/**
 * "Creative Review" — the coordination surface between Samantha (which ads need a refresh), Kai
 * (prompt building + Kie AI generation), and the manager (review → approve).
 *
 * HARD SCOPE BOUNDARY: there is no "Full Auto" mode, no mode switcher, and no settings card. Every
 * brief — manually composed here, or suggested by Samantha — reaches Kai only when a human clicks
 * "Kirim ke Kai" on that specific brief. Nothing in this component runs on a timer except the
 * read-only status poll below, which never triggers generation.
 *
 * Every number and media element shown traces to a real `aaos-api` response: package rows come
 * from the real `creative_packages` table, generated media are real `@aos/asset-library` GCS URLs,
 * the log tab reads the real append-only `creative_logs` audit trail, and the Rekomendasi tab
 * reuses `VerdictEngine`'s already-computed `verdict === "REFRESH"` per ad rather than recomputing
 * any frequency/days/CTR threshold client-side.
 */
export function CreativeClient(): React.ReactElement {
  const [tab, setTab] = useState<TabKey>("REVIEW");
  const [packages, setPackages] = useState<readonly CreativePackageDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  // Same `GET /api/settings` client-side vertical read `ContentStudioClient.tsx` already
  // established for the Sosmed Studio's own AUTOMOTIVE/PROPERTY branch.
  const [vertical, setVertical] = useState<Vertical>("AUTOMOTIVE");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ tenant?: { vertical?: Vertical } }>) : null,
      )
      .then((data) => {
        if (!cancelled && data?.tenant?.vertical !== undefined) {
          setVertical(data.tenant.vertical);
        }
      })
      .catch(() => {
        // Least-surprise default (AUTOMOTIVE) stays in place — same discipline `lib/auth.ts`'s
        // `parseVertical` documents for a missing/unreadable vertical.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/creative?limit=200");
      if (!res.ok) {
        throw new Error("Gagal memuat creative packages.");
      }
      const body = (await res.json()) as { packages: readonly CreativePackageDto[] };
      if (mountedRef.current) {
        setPackages(body.packages);
        setError(undefined);
      }
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : "Gagal memuat creative packages.");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generating = useMemo(
    () => (packages ?? []).filter((pkg) => pkg.status === "GENERATING"),
    [packages],
  );

  // Poll ONLY while something is genuinely running — no background traffic otherwise, and never a
  // trigger for new work.
  useEffect(() => {
    if (generating.length === 0) {
      return;
    }
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [generating.length, load]);

  async function review(
    pkg: CreativePackageDto,
    action: "approve" | "reject",
    selectedCopyVariantId?: string,
  ): Promise<void> {
    setBusyId(pkg.id);
    try {
      const res = await fetch(`/api/creative/${encodeURIComponent(pkg.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "approve" ? { selectedCopyVariantId } : {}),
      });
      if (!res.ok) {
        throw new Error(`Gagal ${action === "approve" ? "menyetujui" : "menolak"} package.`);
      }
      await load();
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : "Gagal memproses package.");
      }
    } finally {
      if (mountedRef.current) {
        setBusyId(undefined);
      }
    }
  }

  /** Called by the manual form and the Samantha tab — both always originate from a human click. */
  async function afterCreate(created: CreativePackageDto): Promise<void> {
    await load();
    if (!mountedRef.current) return;
    if (created.status === "GENERATING") {
      setNotice(`Brief "${created.title}" dikirim ke Kai. Pantau di tab "Sedang Diproses".`);
      setTab("PROCESSING");
      return;
    }
    setNotice(`Brief "${created.title}" disimpan sebagai draft (belum dikirim ke Kai).`);
    setTab("PROCESSING");
  }

  if (error !== undefined && packages === undefined) {
    return <ErrorCard message={error} />;
  }
  if (packages === undefined) {
    return <LoadingSpinner />;
  }

  const now = new Date();
  const pending = packages.filter((pkg) => pkg.status === "PENDING");
  const drafts = packages.filter((pkg) => pkg.status === "DRAFT");
  const failed = packages.filter((pkg) => pkg.status === "FAILED");
  const approvedThisMonth = packages.filter(
    (pkg) => pkg.status === "APPROVED" && isThisMonth(pkg.reviewedAt, now),
  );
  const rejectedThisMonth = packages.filter(
    (pkg) => pkg.status === "REJECTED" && isThisMonth(pkg.reviewedAt, now),
  );
  // AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real, scheduler-computed fatigue signal, FATIGUED
  // packages surfaced first (highest real priority).
  const fatiguedPackages = packages
    .filter((pkg) => pkg.fatigueStatus !== "NORMAL")
    .sort((a, b) =>
      a.fatigueStatus === b.fatigueStatus ? 0 : a.fatigueStatus === "FATIGUED" ? -1 : 1,
    );

  return (
    <div className={styles.page}>
      <div>
        <h2 className={styles.title}>🎨 Creative Review</h2>
        <p className={styles.subtitle}>
          Koordinasi Samantha × Kai × Kie AI. Setiap brief butuh persetujuan manusia sebelum Kai
          generate — tidak ada mode otomatis.
        </p>
      </div>

      <div className={styles.kpiStrip}>
        <MetricCard label="Antrian" value={String(pending.length)} />
        <MetricCard label="Diproses" value={String(generating.length)} />
        <MetricCard label="Draft" value={String(drafts.length)} />
        <MetricCard label="Approved bulan ini" value={String(approvedThisMonth.length)} />
        <MetricCard label="Rejected bulan ini" value={String(rejectedThisMonth.length)} />
      </div>

      <div className={styles.tabs} role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={tab === entry.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => {
              setTab(entry.key);
              setNotice(undefined);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {notice !== undefined ? (
        <p data-testid="creative-notice" className={styles.notice}>
          {notice}
        </p>
      ) : null}
      {error !== undefined ? <ErrorCard message={error} /> : null}

      {tab === "REVIEW" ? (
        <>
          {/* AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real fatigue banner, shown above the grid
              whenever ANY real package (any status, not just PENDING) has a real, scheduler-
              computed fatigueStatus other than NORMAL. */}
          {fatiguedPackages.length > 0 ? (
            <div className={styles.fatigueBanner} data-testid="fatigue-banner">
              <strong>{fatiguedPackages.length} creative package menunjukkan tanda fatigue</strong>
              <ul className={styles.fatigueBannerList}>
                {fatiguedPackages.slice(0, 5).map((pkg) => (
                  <li key={pkg.id}>
                    {pkg.fatigueStatus === "FATIGUED" ? "⚠ " : ""}
                    {pkg.title} — {pkg.fatigueStatus === "FATIGUED" ? "Fatigue" : "Menurun"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pending.length === 0 ? (
            <EmptyState
              title="Tidak ada package menunggu review"
              description="Semua package sudah direview. Buat brief baru di tab “Buat Manual”."
            />
          ) : (
            <div className={styles.list}>
              {pending.map((pkg) => (
                <CreativePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  busy={busyId === pkg.id}
                  onApprove={(selectedCopyVariantId) => {
                    void review(pkg, "approve", selectedCopyVariantId);
                  }}
                  onReject={() => {
                    void review(pkg, "reject");
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === "PROCESSING" ? (
        <ProcessingTab
          generating={generating}
          drafts={drafts}
          failed={failed}
          onGenerate={async (pkg) => {
            setBusyId(pkg.id);
            try {
              const res = await fetch(`/api/creative/${encodeURIComponent(pkg.id)}/generate`, {
                method: "POST",
              });
              if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                  error?: { message?: string };
                };
                throw new Error(body.error?.message ?? "Gagal mengirim brief ke Kai.");
              }
              await load();
            } catch (caught) {
              if (mountedRef.current) {
                setError(caught instanceof Error ? caught.message : "Gagal mengirim ke Kai.");
              }
            } finally {
              if (mountedRef.current) {
                setBusyId(undefined);
              }
            }
          }}
          busyId={busyId}
        />
      ) : null}

      {tab === "MANUAL" ? (
        vertical === "PROPERTY" ? (
          <PropertyManualBriefForm onCreated={afterCreate} />
        ) : (
          <ManualBriefForm onCreated={afterCreate} />
        )
      ) : null}

      {tab === "SAMANTHA" ? <SamanthaRecommendations onCreated={afterCreate} /> : null}

      {tab === "LOG" ? <CreativeLogList /> : null}
    </div>
  );
}

interface ProcessingTabProps {
  readonly generating: readonly CreativePackageDto[];
  readonly drafts: readonly CreativePackageDto[];
  readonly failed: readonly CreativePackageDto[];
  readonly onGenerate: (pkg: CreativePackageDto) => Promise<void>;
  readonly busyId: string | undefined;
}

/**
 * Running Kie AI jobs, saved drafts, and recent failures — all read from the SAME persisted rows
 * the rest of the page uses. There is no fabricated ETA and no fake progress bar: Kie AI reports no
 * intermediate progress, so this shows only what is genuinely known (that the job is running, and
 * when it started).
 */
function ProcessingTab({
  generating,
  drafts,
  failed,
  onGenerate,
  busyId,
}: ProcessingTabProps): React.ReactElement {
  if (generating.length === 0 && drafts.length === 0 && failed.length === 0) {
    return (
      <EmptyState
        title="Tidak ada yang sedang diproses"
        description="Belum ada brief yang dikirim ke Kai dan tidak ada draft tersimpan."
      />
    );
  }
  return (
    <div className={styles.list}>
      {generating.map((pkg) => (
        <section key={pkg.id} data-testid="creative-processing-row" className={styles.row}>
          <p className={styles.rowTitle}>🔄 {pkg.title}</p>
          <p className={styles.rowMeta}>
            Kai sedang generate di Kie AI · mulai {formatDateTimeIdWib(pkg.updatedAt)}
          </p>
          <p className={styles.rowMeta}>
            {pkg.sourcePhotoUrls.length > 0
              ? `${String(pkg.sourcePhotoUrls.length)} foto unit dipakai sebagai referensi.`
              : "Tidak ada foto unit di asset library — Kai generate tanpa foto referensi."}
          </p>
        </section>
      ))}

      {drafts.map((pkg) => (
        <section key={pkg.id} data-testid="creative-draft-row" className={styles.row}>
          <p className={styles.rowTitle}>📋 {pkg.title}</p>
          <p className={styles.rowMeta}>
            Draft · belum dikirim ke Kai · dibuat {formatDateTimeIdWib(pkg.createdAt)}
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={busyId === pkg.id}
            onClick={() => void onGenerate(pkg)}
          >
            🚀 Kirim ke Kai — Generate Sekarang
          </button>
        </section>
      ))}

      {failed.map((pkg) => (
        <section key={pkg.id} data-testid="creative-failed-row" className={styles.row}>
          <p className={styles.rowTitle}>❌ {pkg.title}</p>
          <p className={styles.rowMeta}>Gagal: {pkg.errorMessage ?? "tidak diketahui"}</p>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busyId === pkg.id}
            onClick={() => void onGenerate(pkg)}
          >
            Coba lagi
          </button>
        </section>
      ))}
    </div>
  );
}
