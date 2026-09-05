"use client";

import { useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { friendlyApiErrorMessage } from "@/lib/apiErrorMessage";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type { AssetDetailResponseDto } from "@/types/dashboard.types";

import { CopyVariantList, type CopyVariant } from "./CopyVariantList";
import { MetricCard } from "./MetricCard";
import styles from "./AssetDetailModal.module.css";

/**
 * Sprint 5 Prompt 12 "read-only" detail modal — opened from a Winning Combos card / heatmap
 * thumbnail. Real reuse mapping per the dispatch's own checklist requirement: renders the SAME
 * `MetricCard` (Prompt 11 Blok 2) and `CopyVariantList` (Prompt 11 Blok 3) components the Campaign
 * Detail Drawer uses — not a duplicated markup/CSS copy. No audience breakdown table here (per the
 * spec: "read-only tanpa audience breakdown duplikat karena sudah di context heatmap").
 *
 * Data source: `GET /api/analytics/assets/:id` — this app's OWN existing proxy to `aaos-api`'s real
 * `GET /api/v1/analytics/assets/:assetId` (already reads from the same already-pulled `AdAccount`
 * tree the heatmap/asset-rollup services hold in memory; `aaos-api`'s own `ResponseCache` covers the
 * cost). This is a genuinely different, already-existing, asset-scoped endpoint — not a second
 * live Meta round-trip, and reusing it here (rather than re-deriving copy variants from the
 * heatmap's own flat cell rows, which carry no per-ad copy at all) is the honest choice.
 */
export interface AssetDetailModalProps {
  readonly assetId: string;
  readonly onClose: () => void;
}

function toCopyVariants(data: AssetDetailResponseDto): readonly CopyVariant[] {
  return data.copyVariants.map((variant) => ({
    id: variant.adId,
    name: `${variant.stableId} · ${variant.name}`,
    copyPreview: variant.name,
    metrics: [
      { label: "SPEND", value: variant.spend, format: "idr" },
      { label: "LEAD", value: variant.totalLead, format: "number" },
      { label: "CPL", value: variant.cpl ?? 0, format: "idr" },
    ],
    rankValue: variant.cpl ?? Number.POSITIVE_INFINITY,
    rankDirection: "lowerIsBetter",
  }));
}

export function AssetDetailModal({ assetId, onClose }: AssetDetailModalProps): React.ReactElement {
  const [data, setData] = useState<AssetDetailResponseDto | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetch(`/api/analytics/assets/${encodeURIComponent(assetId)}`);
        if (!res.ok) {
          throw new Error(await friendlyApiErrorMessage(res, "Gagal memuat detail creative."));
        }
        const body = (await res.json()) as AssetDetailResponseDto;
        if (!cancelled) {
          setData(body);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat detail creative.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Detail creative"
        data-testid="asset-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Detail Creative</h2>
          <button type="button" className={styles.closeButton} aria-label="Tutup" onClick={onClose}>
            ✕
          </button>
        </div>
        {loading ? <LoadingSpinner /> : null}
        {!loading && error !== undefined ? <ErrorCard message={error} /> : null}
        {!loading && data !== undefined ? (
          <>
            <div className={styles.metricGrid}>
              <MetricCard label="SPEND" value={formatIdr(data.spend)} />
              <MetricCard label="IMPRESSIONS" value={formatNumber(data.impressions)} />
              <MetricCard label="CLICKS" value={formatNumber(data.clicks)} />
              <MetricCard label="TOTAL LEAD" value={formatNumber(data.totalLead)} />
              <MetricCard
                label="CPL"
                value={data.rphLead !== null ? formatIdr(data.rphLead) : "—"}
              />
              <MetricCard label="AD COUNT" value={formatNumber(data.adCount)} />
            </div>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Copy Variations</h3>
              <CopyVariantList variants={toCopyVariants(data)} />
            </section>
            {data.insight.available ? (
              <p className={styles.insight} data-testid="asset-detail-insight">
                {data.insight.summary}
              </p>
            ) : (
              <p
                className={styles.insightUnavailable}
                data-testid="asset-detail-insight-unavailable"
              >
                {data.insight.message}
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default AssetDetailModal;
