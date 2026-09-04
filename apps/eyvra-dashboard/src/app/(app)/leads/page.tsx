import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 — new "Leads" hub (spec PROMPT 2: "gabungan Clara features" —
 * merges `/clara/inbox`, `/clara/contacts`, `/clara/knowledge`, `/clara/recycling` into one
 * route). Placeholder only this sprint — real tab content is Sprint 2/3.
 *
 * Reclaims the `/leads` path: it previously had no real page of its own here — `middleware.ts`
 * hard-redirected it to `/clara/inbox` as a stale-bookmark compatibility shim from an older
 * retirement of the flat `/leads` list (see that file's own comment). That middleware entry is
 * removed as part of this change so this real page actually renders.
 */
export default function LeadsPage(): React.ReactElement {
  return (
    <PlaceholderPage
      title="Leads"
      description="Inbox percakapan, daftar kontak, knowledge base, dan lead recycling Clara akan digabung ke sini."
    />
  );
}
