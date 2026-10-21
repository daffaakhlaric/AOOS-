"use client";
import { useState } from "react";
import { Card } from "@/components/common/Card";
import { presentLabel } from "@/lib/presentation";
import type { CreativeInfoResult } from "@/lib/stress-test-result";
import { EvidenceBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

/** Right rail "Informasi Creative yang Diuji" — only metadata that resolves from the run's real
 * `creativeIds` (listing photo / creative package), plus the real text the evaluators read. */
export function CreativeInfoCard({
  info,
  loading,
}: {
  readonly info: CreativeInfoResult;
  readonly loading: boolean;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const preview = info.copyPreview;
  const previewText = preview
    ? [preview.headline, preview.primaryText, preview.description]
        .filter((v): v is string => v !== undefined)
        .join("\n\n")
    : "";

  return (
    <Card title="Informasi Creative yang Diuji" testId="stress-test-creative-info-card">
      {loading ? (
        <p className={styles.muted}>Memuat metadata creative…</p>
      ) : info.creatives.length === 0 && preview === undefined ? (
        <p className={styles.muted} data-testid="stress-test-creative-info-empty">
          Metadata creative belum tersedia
        </p>
      ) : (
        <>
          {info.creatives.length === 0 ? (
            <p className={styles.muted}>Tidak ada foto/creative yang dipilih pada run ini.</p>
          ) : (
            info.creatives.map((c) => (
              <div key={c.id} className={styles.creativeItem}>
                {c.thumbnailUrl !== undefined ? (
                  // eslint-disable-next-line @next/next/no-img-element -- real tenant asset URL
                  <img className={styles.creativeThumb} src={c.thumbnailUrl} alt="" />
                ) : (
                  <div className={`${styles.creativeThumb} ${styles.thumbPlaceholder}`}>—</div>
                )}
                <div>
                  <strong>{c.title}</strong>
                  <div className={styles.muted}>Sumber: {c.sourceLabel}</div>
                  {c.format !== undefined ? (
                    <div className={styles.muted}>Format: {presentLabel(c.format)}</div>
                  ) : null}
                  {c.angle !== undefined ? (
                    <div className={styles.muted}>Angle: {presentLabel(c.angle)}</div>
                  ) : null}
                  {c.evaluated ? (
                    <div className={styles.muted}>Teks creative ini yang dievaluasi</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {preview !== undefined && previewText.length > 0 ? (
            <div className={styles.railSection}>
              <div className={styles.badgeRow}>
                <span className={styles.sectionLabel}>
                  {preview.isProxyFromListing
                    ? "Teks yang dievaluasi (proxy dari listing)"
                    : "Copy creative"}
                </span>
                {preview.isProxyFromListing ? <EvidenceBadge kind="LISTING_DATA" /> : null}
              </div>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                {expanded ? "Sembunyikan copy" : "Lihat copy"}
              </button>
              {expanded ? (
                <div className={styles.copyPreview} data-testid="stress-test-copy-preview">
                  {previewText}
                </div>
              ) : null}
              {expanded && preview.isProxyFromListing ? (
                <p className={styles.note}>
                  Disusun dari data listing saat ini — bisa berbeda bila listing diubah setelah run
                  ini.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
