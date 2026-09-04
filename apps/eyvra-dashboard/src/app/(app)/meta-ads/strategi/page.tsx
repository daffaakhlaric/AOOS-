import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/meta-ads/strategi` ("Strategi & Approve") retired into the new Campaign hub's "verdict" tab (real tab content is Sprint 2/3; real `StrategiClient` untouched). */
export default function StrategiPage(): never {
  redirect("/campaigns?tab=verdict");
}
