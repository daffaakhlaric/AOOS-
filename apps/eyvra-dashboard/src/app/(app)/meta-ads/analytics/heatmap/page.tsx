import { redirect } from "next/navigation";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — real path is `/meta-ads/analytics/heatmap` (the
 * spec's own list names a shorter `meta-ads/heatmap` that never existed in this app). Retired
 * into the new Creative hub's "ab-results" tab (real tab content is Sprint 2/3; real
 * `AnalyticsHeatmapClient` untouched).
 */
export default function HeatmapPage(): never {
  redirect("/creative?tab=ab-results");
}
