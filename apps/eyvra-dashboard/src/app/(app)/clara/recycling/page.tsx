import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/clara/recycling` retired into the new Leads hub's "recycling" tab (real tab content is Sprint 2/3; real `RecyclingClient` untouched). */
export default function RecyclingPage(): never {
  redirect("/leads?tab=recycling");
}
