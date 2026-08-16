"use client";

import { useState } from "react";

import { ApproveRejectButtons } from "@/components/creative/ApproveRejectButtons";
import { CopyVariantSelector } from "@/components/creative/CopyVariantSelector";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateId } from "@/lib/formatters";
import type { CreativePackageDto } from "@/types/dashboard.types";

import styles from "./CreativePackageCard.module.css";

export interface CreativePackageCardProps {
  readonly pkg: CreativePackageDto;
  readonly onApprove: (selectedCopyVariantId: string) => void;
  readonly onReject: () => void;
  readonly busy?: boolean;
}

const STATUS_TONE = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

/** Video preview + 3 images + copy variants (spec "creative/page.tsx" mockup: package #KAI-001). */
export function CreativePackageCard({
  pkg,
  onApprove,
  onReject,
  busy = false,
}: CreativePackageCardProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | undefined>(pkg.copyVariants[0]?.id);

  return (
    <section data-testid="creative-package-card" className={styles.section}>
      <div className={styles.headerRow}>
        <p className={styles.name}>
          Package #{pkg.id} · {pkg.unit} {pkg.branch}
        </p>
        <StatusBadge label={pkg.status} tone={STATUS_TONE[pkg.status]} />
      </div>
      <p className={styles.meta}>
        Dibuat: {formatDateId(pkg.createdAt)} · Dari brief #{pkg.briefId}
      </p>

      <div className={styles.mediaRow}>
        {pkg.videoUrl !== undefined ? (
          <div data-testid="creative-video-slot" className={styles.mediaSlot}>
            ▶ Video
          </div>
        ) : null}
        {pkg.imageUrls.map((url, index) => (
          <div key={url} data-testid="creative-image-slot" className={styles.mediaSlot}>
            🖼 Img {index + 1}
          </div>
        ))}
      </div>

      <div className={styles.copySection}>
        <CopyVariantSelector
          variants={pkg.copyVariants}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

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
