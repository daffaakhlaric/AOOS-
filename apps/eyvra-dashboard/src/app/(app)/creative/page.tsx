import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 — "Creative" hub (spec PROMPT 2: "gabungan Kai features" —
 * merges `/creative` (Creative Review), `/listings` (Listing Manager), and `/assets/library`
 * (Asset Library) into one route). Placeholder only this sprint — real tab content is Sprint 2/3.
 *
 * Real deviation: this app's OLD Creative Review page already lived at this exact `/creative`
 * path (no `creative-review/` -> `/property/creative` rename was needed, unlike the spec's own
 * assumption — see PROMPT 9's list), so the new hub and the old page coincide at the same real
 * URL. Rather than fabricate a second, differently-named route to redirect from, this file's
 * content is replaced in place — the previous `CreativeClient` (creative-package approval list)
 * is untouched in `src/components/creative/CreativeClient.tsx` and simply not rendered here for
 * now; wiring it back in as one of this hub's real tabs is Sprint 2/3 work, not deleted.
 */
export default function CreativePage(): React.ReactElement {
  return (
    <PlaceholderPage
      title="Creative"
      description="Creative Review, Listing Manager, dan Asset Library akan digabung ke sini."
    />
  );
}
