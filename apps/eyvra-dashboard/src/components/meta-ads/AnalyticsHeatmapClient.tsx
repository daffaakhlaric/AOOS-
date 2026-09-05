"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AssetDetailModal } from "@/components/analytics/AssetDetailModal";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { friendlyApiErrorMessage } from "@/lib/apiErrorMessage";
import type { HeatmapCellDto, HeatmapResponseDto } from "@/types/dashboard.types";

import { HeatmapGrid } from "./HeatmapGrid";
import { RankedCombosList } from "./RankedCombosList";
import { WinningCombos, type WinningCombosMetric } from "./WinningCombos";
import styles from "./AnalyticsHeatmapClient.module.css";

const DEFAULT_DATE_PRESET = "last_30d";

type AssetTypeFilter = "all" | "IMAGE" | "VIDEO";
type BreakdownMode = "matrix" | "ranked";

const SORT_OPTIONS: ReadonlyArray<{ readonly id: WinningCombosMetric; readonly label: string }> = [
  { id: "ctr", label: "CTR" },
  { id: "cpl", label: "CPL" },
  { id: "spend", label: "Spend" },
];

function filterCells(
  cells: readonly HeatmapCellDto[],
  assetType: AssetTypeFilter,
): readonly HeatmapCellDto[] {
  if (assetType === "all") {
    return cells;
  }
  return cells.filter((cell) => cell.assetKind === assetType);
}

/** Picks the single best real cell by the active sort metric — powers the insight banner's real
 * "Kombinasi terbaik: [creative] × [segment]" copy (never a fabricated pairing). */
function bestCell(
  cells: readonly HeatmapCellDto[],
  metric: WinningCombosMetric,
): HeatmapCellDto | undefined {
  if (cells.length === 0) {
    return undefined;
  }
  return [...cells].sort((a, b) => {
    const va = metric === "ctr" ? (a.ctr ?? -1) : metric === "cpl" ? (a.cpl ?? Infinity) : a.spend;
    const vb = metric === "ctr" ? (b.ctr ?? -1) : metric === "cpl" ? (b.cpl ?? Infinity) : b.spend;
    return metric === "cpl" ? va - vb : vb - va;
  })[0];
}

const AUDIENCE_LABEL_TEXT_ID: Readonly<Record<string, string>> = {
  BROAD: "Broad",
  INTEREST: "Interest",
  LOOKALIKE_1: "Lookalike 1%",
  RETARGETING: "Retargeting",
  CUSTOM_CRM: "Custom/CRM",
};

/**
 * `/meta-ads/analytics/heatmap` page body (AAOS Analytics Platform Phase 3), upgraded per Sprint 5
 * Prompt 12 with a Winning Combos section + a Matrix/Ranked toggle over the same real `cells`.
 * Auto-fetches `/api/analytics/heatmap` on mount (unlike `useCampaignsSnapshot`'s deliberate
 * manual-fetch-only house style for the shared campaigns snapshot — this page has its own dedicated
 * endpoint with its own 15-minute server-side cache, so a plain auto-fetch-on-mount is the simplest
 * honest behavior for a standalone analytics report page, not a second convention competing with the
 * shared snapshot).
 *
 * "Apply ke campaign aktif" (Prompt 12's insight banner): a real `POST /api/v1/campaigns/apply-
 * winning-combo` endpoint does not exist anywhere in this codebase (confirmed by search), and the
 * one real "apply a suggestion" mechanism that does exist — `POST /api/verdicts` — applies a
 * SCALE/PAUSE/FIX/REFRESH verdict to ONE ad/ad-set/campaign, a different real action than "route
 * more of a campaign's budget/targeting toward this creative × audience pairing". Rather than invent
 * a backend action with no real implementation behind it, this links straight to the real Campaigns
 * "Aktif" tab where a person can act on the real per-ad Execute buttons already wired to that real
 * verdict endpoint — same honest-navigation precedent `CampaignsHubClient`'s own "Jalankan loop ↗"
 * button already documents for a comparable real gap.
 */
export function AnalyticsHeatmapClient(): React.ReactElement {
  const [data, setData] = useState<HeatmapResponseDto | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [assetType, setAssetType] = useState<AssetTypeFilter>("all");
  const [sortMetric, setSortMetric] = useState<WinningCombosMetric>("ctr");
  const [mode, setMode] = useState<BreakdownMode>("matrix");
  const [openAssetId, setOpenAssetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(undefined);
      try {
        const params = new URLSearchParams({ datePreset: DEFAULT_DATE_PRESET });
        const res = await fetch(`/api/analytics/heatmap?${params.toString()}`);
        if (!res.ok) {
          throw new Error(
            await friendlyApiErrorMessage(res, "Gagal memuat heatmap audiens × kreatif."),
          );
        }
        const body = (await res.json()) as HeatmapResponseDto;
        if (!cancelled) {
          setData(body);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Gagal memuat heatmap audiens × kreatif.",
          );
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
  }, []);

  const filteredCells = useMemo(
    () => (data === undefined ? [] : filterCells(data.cells, assetType)),
    [data, assetType],
  );
  const winner = useMemo(() => bestCell(filteredCells, sortMetric), [filteredCells, sortMetric]);

  if (loading) {
    return <LoadingSpinner />;
  }
  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <ErrorCard message="Tidak ada data heatmap yang diterima." />;
  }

  return (
    <div className={styles.wrap}>
      {/* FILTER BAR (Prompt 12): [All Types ▾] [Sort ▾] — real date range picker/settings icon are
          NOT added here since this page has no real per-request date-range control today (it
          always requests a fixed `last_30d` preset — see this file's own docstring for why an
          auto-fetch-on-mount page has no manual pull control at all); adding a picker with no real
          backend param behind it would be a fabricated control, so only the two real, honestly-
          wireable filters (asset type / sort metric) are rendered. */}
      <div className={styles.filterBar} data-testid="heatmap-filter-bar">
        <label className={styles.filterLabel}>
          Type{" "}
          <select
            value={assetType}
            onChange={(event) => setAssetType(event.target.value as AssetTypeFilter)}
            className={styles.filterSelect}
            aria-label="Filter tipe creative"
          >
            <option value="all">All Types</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
          </select>
        </label>
        <label className={styles.filterLabel}>
          Sort{" "}
          <select
            value={sortMetric}
            onChange={(event) => setSortMetric(event.target.value as WinningCombosMetric)}
            className={styles.filterSelect}
            aria-label="Sort metric"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <WinningCombos cells={filteredCells} metric={sortMetric} onOpenAsset={setOpenAssetId} />

      <div className={styles.breakdownHeader}>
        <div className={styles.sectionHeaderText}>
          <h3 className={styles.sectionTitle}>Performance Breakdown</h3>
          <p className={styles.sectionSubtitle}>Creative performance across audience segments</p>
        </div>
        <div className={styles.modeToggle} role="group" aria-label="Mode tampilan">
          <button
            type="button"
            aria-pressed={mode === "matrix"}
            onClick={() => setMode("matrix")}
            className={`${styles.modeButton} ${mode === "matrix" ? styles.modeButtonActive : ""}`}
          >
            Matrix
          </button>
          <button
            type="button"
            aria-pressed={mode === "ranked"}
            onClick={() => setMode("ranked")}
            className={`${styles.modeButton} ${mode === "ranked" ? styles.modeButtonActive : ""}`}
          >
            Ranked
          </button>
        </div>
      </div>

      {winner !== undefined ? (
        <div className={styles.insightBanner} data-testid="winning-combo-banner">
          <span>
            Kombinasi terbaik: {winner.assetId} ×{" "}
            {AUDIENCE_LABEL_TEXT_ID[winner.audienceLabel] ?? winner.audienceLabel}
          </span>
          <Link href="/campaigns" className={styles.applyLink}>
            Apply ke campaign aktif ↗
          </Link>
        </div>
      ) : null}

      {mode === "matrix" ? (
        <HeatmapGrid
          heatmap={{
            ...data,
            cells: filteredCells,
            creativeAssetIds: data.creativeAssetIds.filter((id) =>
              filteredCells.some((cell) => cell.assetId === id),
            ),
            audienceLabels: data.audienceLabels.filter((label) =>
              filteredCells.some((cell) => cell.audienceLabel === label),
            ),
          }}
        />
      ) : (
        <RankedCombosList cells={filteredCells} metric={sortMetric} onOpenAsset={setOpenAssetId} />
      )}

      {openAssetId !== undefined ? (
        <AssetDetailModal assetId={openAssetId} onClose={() => setOpenAssetId(undefined)} />
      ) : null}
    </div>
  );
}
