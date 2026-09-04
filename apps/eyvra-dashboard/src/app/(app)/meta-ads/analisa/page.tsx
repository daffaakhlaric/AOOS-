import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/meta-ads/analisa` ("Analisa & Rekomendasi") retired into the new Campaign hub's "verdict" tab (real tab content is Sprint 2/3; real `AnalisaClient` untouched). */
export default function AnalisaPage(): never {
  redirect("/campaigns?tab=verdict");
}
