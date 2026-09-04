import { LeadsHubClient } from "@/components/leads/LeadsHubClient";

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 (PROMPT 4) — real "Leads" hub. `?tab=` matches Sprint 1's own
 * real redirect targets exactly (`tests/app/redirects.test.tsx`: `semua`, `recycling`,
 * `knowledge-base`; bare `/leads` — from `/clara/inbox` — lands on the default "pipeline" tab).
 * `?lead=` (from `ContactsClient`/`LeadDetailDrawer` row/card clicks into the real "Inbox" tab)
 * is read server-side and passed down, same real convention the OLD `/clara/inbox/page.tsx` used
 * for `ClaraInboxClient`'s `initialLeadId` — never `useSearchParams()` client-side.
 */
export default function LeadsPage({
  searchParams,
}: {
  readonly searchParams: { readonly tab?: string; readonly lead?: string };
}): React.ReactElement {
  return <LeadsHubClient initialTab={searchParams.tab} initialLeadId={searchParams.lead} />;
}
