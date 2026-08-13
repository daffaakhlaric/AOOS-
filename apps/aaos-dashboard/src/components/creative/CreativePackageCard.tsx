"use client";

import { useState } from "react";

import { ApproveRejectButtons } from "@/components/creative/ApproveRejectButtons";
import { CopyVariantSelector } from "@/components/creative/CopyVariantSelector";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateId } from "@/lib/formatters";
import type { CreativePackageDto } from "@/types/dashboard.types";

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
    <section
      data-testid="creative-package-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">
          Package #{pkg.id} · {pkg.unit} {pkg.branch}
        </p>
        <StatusBadge label={pkg.status} tone={STATUS_TONE[pkg.status]} />
      </div>
      <p className="text-sm text-ink-muted">
        Dibuat: {formatDateId(pkg.createdAt)} · Dari brief #{pkg.briefId}
      </p>

      <div className="mt-3 flex gap-2">
        {pkg.videoUrl !== undefined ? (
          <div
            data-testid="creative-video-slot"
            className="flex h-16 w-16 items-center justify-center rounded-button bg-surface-page text-xs text-ink-muted"
          >
            ▶ Video
          </div>
        ) : null}
        {pkg.imageUrls.map((url, index) => (
          <div
            key={url}
            data-testid="creative-image-slot"
            className="flex h-16 w-16 items-center justify-center rounded-button bg-surface-page text-xs text-ink-muted"
          >
            🖼 Img {index + 1}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <CopyVariantSelector
          variants={pkg.copyVariants}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {pkg.status === "PENDING" ? (
        <div className="mt-3">
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
