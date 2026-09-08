import { CampaignsHubClient } from "@/components/campaigns/CampaignsHubClient";

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the real `/campaigns` page, REBUILT from `02c475f`'s tabbed
 * structure (Metrics/Aktif/Verdict/A-B Testing/Anggaran/Objective) into one tab-less, vertical-
 * scroll page per the user's own spec. See `CampaignsHubClient.tsx`'s own extensive doc for the
 * full real layout/data-source/honest-degrade rationale.
 *
 * `?view=ab-testing` is the one remaining query param this route reads — a real, deliberate
 * escape hatch to the retired "A/B Testing" tab's still-real `AbTestingClient` (see
 * `CampaignsHubClient.tsx`'s own "A/B TESTING TAB DECISION" doc for why it stays reachable rather
 * than silently dropped). Every other `?tab=` value the pre-rebuild route used to accept
 * (`verdict`/`ab`/`anggaran`/`objective`/`metrics`) no longer has a distinct destination — the
 * unified page shows everything on one scroll, so those old links now simply land on the bare
 * unified page (a real, honest behavior change, not a broken link — the content they used to point
 * at is still on this same page, just not behind a tab anymore).
 */
export default function CampaignsPage({
  searchParams,
}: {
  readonly searchParams: { readonly view?: string };
}): React.ReactElement {
  return <CampaignsHubClient initialView={searchParams.view} />;
}
