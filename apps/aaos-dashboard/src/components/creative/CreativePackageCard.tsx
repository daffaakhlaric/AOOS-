"use client";

import { useState } from "react";

import { ApproveRejectButtons } from "@/components/creative/ApproveRejectButtons";
import { CopyVariantSelector } from "@/components/creative/CopyVariantSelector";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTimeIdWib } from "@/lib/formatters";
import type { CreativePackageDto } from "@/types/dashboard.types";

import styles from "./CreativePackageCard.module.css";

export interface CreativePackageCardProps {
  readonly pkg: CreativePackageDto;
  readonly onApprove: (selectedCopyVariantId: string) => void;
  readonly onReject: () => void;
  readonly busy?: boolean;
}

const STATUS_TONE = {
  DRAFT: "neutral",
  GENERATING: "warning",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  FAILED: "danger",
} as const;

const FORMAT_LABEL = {
  VIDEO_AND_IMAGES: "Video + Gambar",
  IMAGES_ONLY: "Gambar saja",
} as const;

/**
 * One creative package in the review queue.
 *
 * Renders REAL `<video controls>` / `<img>` elements against the package's real
 * `@aos/asset-library` GCS public URLs, replacing the previous placeholder `▶ Video` / `🖼 Img N`
 * text tiles — a manager cannot approve a creative they have not actually watched.
 *
 * Every field shown traces to a real persisted column: the Kie AI model string is the one Kai
 * actually used (`veo3_fast` / `nano-banana-pro`), `decidedFormat` is what Kai's real
 * `FormatDecider` chose (which can differ from what was requested when a unit has no source
 * photos), and "Sumber foto" counts the real asset-library photos found for the unit. Nothing here
 * is derived from a placeholder or a guess.
 */
export function CreativePackageCard({
  pkg,
  onApprove,
  onReject,
  busy = false,
}: CreativePackageCardProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | undefined>(pkg.copyVariants[0]?.id);
  const hasMedia = pkg.videoUrl !== undefined || pkg.imageUrls.length > 0;

  return (
    <section data-testid="creative-package-card" className={styles.section}>
      <div className={styles.headerRow}>
        <p className={styles.name}>
          {pkg.title}
          {pkg.stableId !== undefined ? ` · dari #${pkg.stableId}` : ""}
        </p>
        <StatusBadge label={pkg.status} tone={STATUS_TONE[pkg.status]} />
      </div>
      <p className={styles.meta}>
        Brief oleh: {pkg.origin === "SAMANTHA" ? "Samantha" : "Manager"} · Generate: Kai ·{" "}
        {formatDateTimeIdWib(pkg.createdAt)}
      </p>
      <p className={styles.meta}>
        Angle {pkg.angle} · {FORMAT_LABEL[pkg.decidedFormat ?? pkg.requestedFormat]}
        {pkg.decidedFormat !== undefined && pkg.decidedFormat !== pkg.requestedFormat
          ? ` (diminta: ${FORMAT_LABEL[pkg.requestedFormat]} — Kai turunkan karena foto sumber tidak cukup)`
          : ""}
        {pkg.aiModel !== undefined ? ` · Model: ${pkg.aiModel}` : ""}
      </p>

      {pkg.errorMessage !== undefined ? (
        <p data-testid="creative-package-error" className={styles.error}>
          Generate gagal: {pkg.errorMessage}
        </p>
      ) : null}

      {hasMedia ? (
        <div className={styles.mediaRow}>
          {pkg.videoUrl !== undefined ? (
            <video
              data-testid="creative-video"
              className={styles.video}
              src={pkg.videoUrl}
              controls
              preload="metadata"
            />
          ) : null}
          {pkg.imageUrls.map((url, index) => (
            /* `next/image` would need the GCS host allow-listed in next.config.mjs and buys
               nothing here: these are already-sized GCS objects rendered at review scale inside an
               internal queue, not LCP hero images. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              data-testid="creative-image"
              className={styles.image}
              src={url}
              alt={`Gambar ${String(index + 1)} untuk ${pkg.title}`}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}

      {pkg.sourcePhotoUrls.length > 0 ? (
        <p className={styles.meta}>
          Sumber foto: {pkg.sourcePhotoUrls.length}{" "}
          {pkg.vertical === "PROPERTY"
            ? "foto dari listing"
            : `foto unit dari stok Mobix${pkg.unit !== undefined ? ` (${pkg.unit})` : ""}`}
        </p>
      ) : pkg.status !== "DRAFT" ? (
        <p className={styles.meta}>
          {pkg.vertical === "PROPERTY"
            ? "Sumber foto: listing ini tidak punya foto saat generate."
            : `Sumber foto: tidak ada foto unit${pkg.unit !== undefined ? ` ${pkg.unit}` : ""} di asset library saat generate.`}
        </p>
      ) : null}

      {pkg.copyVariants.length > 0 ? (
        <div className={styles.copySection}>
          <CopyVariantSelector
            variants={pkg.copyVariants}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      ) : null}

      {pkg.status === "PENDING" ? (
        <div className={styles.actions}>
          <ApproveRejectButtons
            onApprove={() => selectedId !== undefined && onApprove(selectedId)}
            onReject={onReject}
            disabled={busy || selectedId === undefined}
          />
        </div>
      ) : null}
    </section>
  );
}
