import { AbTestingClient } from "@/components/meta-ads/AbTestingClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * `/experiments` — EYVRA SAMANTHA V2 + KAI V2 Phase 53 (PROMPT 84). Real dedicated "Experiments"
 * page for the Sidebar's "Experiments" item, replacing Phase 50's `redirect()` stub.
 *
 * `AbTestingClient` (RUNNING/COMPLETE/DRAFT lifecycle, real KPI strip, card-based
 * control/variant thumbnails, per-variant real metrics, threshold progress bar) is REUSED
 * WHOLESALE here — same component the old `/campaigns?view=ab-testing` escape hatch renders,
 * unmodified in shape. It was already fully self-contained (no props, fetches its own real data
 * via `/api/abtesting`, no shared state with `CampaignsHubClient`), so hosting it on its own page
 * shell (same `TopBar` + reuse recipe `KaiStudioPage`/`LeadsPage` already establish) needed no
 * extraction or duplication — only this file changed.
 *
 * `/campaigns?view=ab-testing` is left reachable (its own internal link from
 * `CampaignInsightPanel`'s footer, and `CampaignsHubClient`'s own "A/B TESTING TAB DECISION" doc,
 * are both untouched — out of this phase's scope) and now renders the exact same real UI this
 * page does, just via a different entry point.
 *
 * Card layout already matches the mockup's panel 6 shape ("card-based, control/variant
 * thumbnails, primary metric") without any change; this phase's only real UI addition is the
 * threshold progress bar (`AbTestingClient`'s own `thresholdProgressPct` — real combined spend/
 * days-elapsed vs. the test's real `thresholdSpend`/`thresholdDays`, mirroring `aaos-api`'s real
 * `isThresholdMet` OR-gate). No fabricated "confidence%"/CPQL/"qualified leads remaining" — this
 * app's real `AbTestDto` has no qualified-lead or confidence field, so those mockup labels are
 * honestly not reproduced here.
 */
export default function ExperimentsPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Experiments" accentColor="var(--v2-menu-analytics)" />
      <AbTestingClient />
    </main>
  );
}
