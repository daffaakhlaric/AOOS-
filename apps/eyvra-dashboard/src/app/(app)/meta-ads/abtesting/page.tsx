import { redirect } from "next/navigation";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — real path is `/meta-ads/abtesting` (the spec's own
 * list names a differently-spelled `meta-ads/ab-testing` that never existed in this app). Retired
 * into the new Campaign hub's "ab" tab (real tab content is Sprint 2/3; real `AbTestingClient`
 * untouched).
 */
export default function AbTestingPage(): never {
  redirect("/campaigns?tab=ab");
}
