import { AssetDetailClient } from "@/components/meta-ads/AssetDetailClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * Asset detail / Creative Drill-Down page (AAOS Analytics Platform Phase 4,
 * `docs/PROMPT-AAOS-ANALYTICS-PLATFORM.md`). Route shape `/meta-ads/analytics/assets/:id` matches
 * exactly what `HeatmapGrid.tsx`'s cell `Link` already constructs
 * (`/meta-ads/analytics/assets/${encodeURIComponent(cell.assetId)}`) — that link was a documented
 * expected-404 until this phase; it now resolves for real.
 */
export default function AssetDetailPage({
  params,
}: {
  readonly params: { readonly id: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Detail Aset Kreatif" />
      <AssetDetailClient assetId={params.id} />
    </main>
  );
}
