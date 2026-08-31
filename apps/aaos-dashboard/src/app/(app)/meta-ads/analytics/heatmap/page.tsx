import { TopBar } from "@/components/layout/TopBar";
import { AnalyticsHeatmapClient } from "@/components/meta-ads/AnalyticsHeatmapClient";

/** "Audience × Creative Heatmap" page (AAOS Analytics Platform Phase 3, `docs/PROMPT-AAOS-ANALYTICS-PLATFORM.md`). */
export default function HeatmapPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Heatmap Audiens × Kreatif" />
      <AnalyticsHeatmapClient />
    </main>
  );
}
