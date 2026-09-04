import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/meta-ads/lookalike` ("Lookalike Audience") retired into the new Campaign hub (real tab content is Sprint 2/3; real `LookalikeClient` untouched). */
export default function LookalikePage(): never {
  redirect("/campaigns");
}
