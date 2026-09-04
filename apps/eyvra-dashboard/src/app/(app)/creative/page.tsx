import { CreativeHubClient } from "@/components/creative/CreativeHubClient";

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 (PROMPT 5) — real "Creative" hub. `?tab=` matches Sprint 1's own
 * real redirect targets exactly (`tests/app/redirects.test.tsx`: `ab-results`, `listing`,
 * `assets`).
 *
 * `?listingId=` is the real, pre-existing query param `ListingDetailClient.tsx`'s own
 * "🎨 Buat Creative dengan Kai →" button already navigates here with (`router.push(
 * "/creative?listingId=...")`) — that real button predates this sprint and was landing on Sprint
 * 1's bare placeholder with the param silently ignored. When present with no explicit `tab`, it
 * now defaults straight to the real "review-kai" tab (`CreativeClient`'s own "Buat Manual" brief
 * form) instead of the bare Asset Library default — closing that real, previously-dead
 * integration. Real per-listing pre-selection INSIDE the form itself is not wired this sprint
 * (`ManualBriefForm`/`PropertyManualBriefForm` have no prefill prop today) — the form's own real
 * listing picker still requires a manual pick, honestly left as-is rather than fabricated.
 */
export default function CreativePage({
  searchParams,
}: {
  readonly searchParams: { readonly tab?: string; readonly listingId?: string };
}): React.ReactElement {
  const initialTab =
    searchParams.tab ?? (searchParams.listingId !== undefined ? "review-kai" : undefined);
  return <CreativeHubClient initialTab={initialTab} />;
}
