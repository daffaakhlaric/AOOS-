import { redirect } from "next/navigation";

/**
 * EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68) — `Experiments` sidebar item's real destination.
 * This app's real formal A/B-test lifecycle UI (`AbTestingClient` — RUNNING/COMPLETE/DRAFT tests)
 * already lives at `/campaigns?view=ab-testing` (see `CampaignsHubClient.tsx`'s own "A/B TESTING TAB
 * DECISION" doc) — the mockup's dedicated card-based Experiments page (control/variant thumbnails,
 * progress bar) is real future work, out of this foundation phase's scope. Same real
 * `redirect()`-only pattern this app already established for the old `/meta-ads/abtesting` retirement
 * (see that route's own doc), never a fabricated second experiments surface.
 */
export default function ExperimentsPage(): never {
  redirect("/campaigns?view=ab-testing");
}
