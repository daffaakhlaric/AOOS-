"use client";

import { useEffect, useState } from "react";

import { CampaignFunnelBar } from "@/components/meta-ads/CampaignFunnelBar";
import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr } from "@/lib/formatters";
import type { AdAccountSummaryDto, CampaignAdDto } from "@/types/dashboard.types";

import styles from "./CampaignDetailClient.module.css";

/** Campaign detail (spec "meta-ads/[campaignId]/page.tsx") — finds `campaignId` (an ad's id) within `/api/campaigns`'s flattened list; `aaos-api` has no dedicated single-ad lookup endpoint, so this reuses the same list endpoint the overview page uses. */
export function CampaignDetailClient({
  campaignId,
}: {
  readonly campaignId: string;
}): React.ReactElement {
  const [ad, setAd] = useState<CampaignAdDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat detail iklan.");
        }
        return (await res.json()) as AdAccountSummaryDto;
      })
      .then((body) => {
        if (!cancelled) {
          setAd(body.ads.find((candidate) => candidate.id === campaignId) ?? null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat detail iklan.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (ad === undefined) {
    return <LoadingSpinner />;
  }
  if (ad === null) {
    return (
      <EmptyState
        title="Iklan tidak ditemukan"
        description={`Tidak ada iklan dengan id "${campaignId}".`}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.name}>{ad.name}</h2>
          <p className={styles.campaignName}>{ad.campaignName}</p>
        </div>
        <VerdictBadge verdict={ad.verdict} />
      </div>
      <p className={styles.spend}>Belanja: {formatIdr(ad.metrics.spend)}</p>
      <CampaignFunnelBar metrics={ad.metrics} />
    </div>
  );
}
