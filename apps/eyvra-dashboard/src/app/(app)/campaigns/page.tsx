import { CampaignsHubClient } from "@/components/campaigns/CampaignsHubClient";

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 (PROMPT 3) — real "Campaign" hub: consolidates every Samantha
 * (Meta Ads) feature into one tabbed page. Each tab renders the REAL, already-existing Client
 * component untouched since Sprint 1's redirect stubs (`MetaAdsClient`/`StrategiClient`/
 * `AnalisaClient`/`AbTestingClient`/`AuditClient`/`LookalikeClient`/`ObjectiveClient`) — nothing
 * rebuilt from scratch. `?tab=` matches Sprint 1's own real redirect targets exactly (confirmed
 * against `tests/app/redirects.test.tsx`: `verdict`, `ab`, `anggaran`; the plain `/campaigns` with
 * no query — from `/meta-ads` and `/meta-ads/lookalike` — lands on the default "aktif" tab).
 *
 * `tab=objective` is a Sprint 2 ADDITION beyond Sprint 1's own redirect map: the user's PROMPT 3
 * spec explicitly asks for an "Objective" tab inside this hub (target stepper, strategy preview),
 * and the real `ObjectiveClient` is the exact real component for that feature — even though Sprint
 * 1's OWN separate `/objective` redirect stub points at `/settings?tab=objective` instead (a real,
 * deliberate, differently-scoped decision documented in that stub's own comment: full Settings
 * hub rebuild is Prompt 8, a later sprint). Both real entry points now honestly reach the same real
 * `ObjectiveClient` until Prompt 8 lands and this hub's tab can be retired in favor of Settings'.
 */
export default function CampaignsPage({
  searchParams,
}: {
  readonly searchParams: { readonly tab?: string };
}): React.ReactElement {
  return <CampaignsHubClient initialTab={searchParams.tab} />;
}
