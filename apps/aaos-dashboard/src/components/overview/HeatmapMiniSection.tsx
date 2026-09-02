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
