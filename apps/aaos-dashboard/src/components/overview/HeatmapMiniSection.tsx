import { EmptyState } from "@/components/ui/EmptyState";
import { HeatmapGrid } from "@/components/meta-ads/HeatmapGrid";
import type { HeatmapResponseDto } from "@/types/dashboard.types";

/**
 * "Heatmap mini" section (spec "BAGIAN 10"). REAL DECISION: reuses the already-built
 * `HeatmapGrid.tsx` (Analytics Platform Phase 3's real audience × creative CPL grid, same
 * `benchmarkCplIDR`/`CPL_BENCHMARK_MULTIPLIER` shading the spec's own mockup describes) directly
 * rather than a second, from-scratch "mini" grid — it already renders compactly enough for this
 * section, reads O1's real `heatmap` field with zero adapter code, and avoids drifting from the
 * dedicated `/meta-ads/analytics/heatmap` page's own real cell-coloring logic.
 *
 * COLORFUL BRAND GUIDELINE V2 (Phase B3, "HEATMAP — COLORED THUMBNAILS + VIBRANT CELLS") — REAL
 * DATA-SHAPE / SCOPE DEVIATION: this component itself has NO cell-rendering code of its own — it
 * is a pure pass-through to `HeatmapGrid.tsx` (confirmed by direct read, above). It also has no
 * `.module.css` file (no CSS Module import here at all). There is nothing in THIS file to
 * recolor. The spec's `CREATIVE_THUMB_COLORS`/`CELL_STYLES` cell treatment belongs to
 * `HeatmapGrid.tsx` (`src/components/meta-ads/HeatmapGrid.tsx`) — that file is outside this
 * phase's explicit file list (`apps/aaos-dashboard/src/components/overview/*` + `CampaignTable.tsx`
 * only) and is a real, separate recoloring target for a later phase (it already has its own real
 * benchmark-CPL cell shading from Analytics Platform Phase 3, independently of this v2 pass).
 * Left untouched here rather than reached into out-of-scope territory.
 */
export function HeatmapMiniSection({
  heatmap,
}: {
  readonly heatmap?: HeatmapResponseDto;
}): React.ReactElement {
  if (heatmap === undefined) {
    return (
      <EmptyState
        title="Data heatmap tidak tersedia"
        description="Pull Meta Ads gagal atau belum pernah dilakukan untuk periode ini."
      />
    );
  }

  return <HeatmapGrid heatmap={heatmap} />;
}
