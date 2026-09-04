import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "go-live-monitor/" equivalent) — `/go-live` retired into the new Aktivitas hub. Low-risk: `GoLiveClient` already always rendered empty (see its own docstring), so no real functionality is lost by this redirect. */
export default function GoLivePage(): never {
  redirect("/activity");
}
