"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { formatNumber } from "@/lib/formatters";
import type { CreativePackageDto, CreativePackageStatusDto } from "@/types/dashboard.types";

import styles from "./KaiProductionCard.module.css";

const STATUS_LABEL: Record<CreativePackageStatusDto, string> = {
  DRAFT: "Draft",
  GENERATING: "Generating",
  PENDING: "Review",
  PENDING_REVIEW: "Brief review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FAILED: "Failed",
};

const STATUS_TILE_TONE: Record<CreativePackageStatusDto, string> = {
  DRAFT: styles.tone_draft ?? "",
  GENERATING: styles.tone_generating ?? "",
  PENDING: styles.tone_pending ?? "",
  PENDING_REVIEW: styles.tone_pending ?? "",
  APPROVED: styles.tone_approved ?? "",
  REJECTED: styles.tone_rejected ?? "",
  FAILED: styles.tone_rejected ?? "",
};

export function KaiProductionCard(): React.ReactElement {
  const [packages, setPackages] = useState<readonly CreativePackageDto[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/creative?limit=200")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ packages: readonly CreativePackageDto[] }>) : null,
      )
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setPackages(body.packages);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return <ErrorState message="Data produksi Kai belum bisa dimuat." />;
  }
  if (packages === undefined) {
    return <LoadingState processLabel="Memuat produksi Kai..." />;
  }
  if (packages.length === 0) {
    return (
      <EmptyState
        title="Belum ada creative package"
        description="Belum ada brief yang dikirim ke Kai untuk tenant ini."
      />
    );
  }

  const approved = packages.filter((pkg) => pkg.status === "APPROVED").length;
  const total = packages.length;
  const readyPct = total > 0 ? Math.round((approved / total) * 100) : 0;
  /**
   * Real failure state. A package with `status: "FAILED"` produced NO images — so when every (or
   * nearly every) real package failed, silently rendering status placeholders reads as "Kai made
   * nothing visual" when the truth is "generation errored". Surfaced as a short human notice; the
   * raw provider string (`errorMessage`, e.g. a Kie AI HTTP error) stays in the `title` tooltip
   * only, never as primary UI copy.
   */
  const failedPackages = packages.filter((pkg) => pkg.status === "FAILED");
  const withImages = packages.filter(
    (pkg) => (pkg.imageUrls?.length ?? 0) > 0 || pkg.videoUrl !== undefined,
  ).length;
  const failureDetail = failedPackages.find((pkg) => pkg.errorMessage !== undefined)?.errorMessage;
  // Compact Row-E slot this round (~135-155px height budget, beside Active Experiments) — statistics
  // become small metadata (the 3-cell grid below), not the primary visual content; the real package
  // thumbnail grid is capped tighter (was 6) to fit. Never padded — `recent` is always <= real
  // `packages.length`.
  const recent = [...packages]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div data-testid="cc-kai-production">
      {failedPackages.length > 0 && withImages === 0 ? (
        <p
          className={styles.failureNotice}
          data-testid="cc-kai-failure-notice"
          title={failureDetail}
        >
          ⚠ {formatNumber(failedPackages.length)} dari {formatNumber(total)} generation gagal —
          belum ada visual yang dihasilkan. Cek koneksi provider generation.
        </p>
      ) : null}
      <div className={styles.progressRow}>
        <p className={styles.progressLabel}>
          {formatNumber(approved)} dari {formatNumber(total)} siap ({readyPct}%)
        </p>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${readyPct}%` }} />
        </div>
      </div>
      <ul className={styles.packageGrid} data-testid="cc-kai-package-grid">
        {recent.map((pkg) => (
          <li key={pkg.id} className={styles.packageTile}>
            {pkg.imageUrls?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- trusted backend asset URL, no image proxy configuration required.
              <img
                className={styles.packageImage}
                src={pkg.imageUrls[0]}
                alt={pkg.title}
                loading="lazy"
              />
            ) : pkg.videoUrl ? (
              <video
                className={styles.packageImage}
                src={pkg.videoUrl}
                controls
                preload="metadata"
                aria-label={pkg.title}
              />
            ) : (
              <div className={`${styles.packagePlaceholder} ${STATUS_TILE_TONE[pkg.status]}`}>
                <span>▧</span>
                <small>
                  {pkg.decidedFormat ?? pkg.requestedFormat ?? "Creative"} · {pkg.id.slice(0, 8)}
                </small>
              </div>
            )}
            <p className={styles.packageTitle} title={pkg.title}>
              <Link href={`/kai-studio?package=${encodeURIComponent(pkg.id)}`}>{pkg.title}</Link>
            </p>
            <p className={styles.packageStatus}>{STATUS_LABEL[pkg.status]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
