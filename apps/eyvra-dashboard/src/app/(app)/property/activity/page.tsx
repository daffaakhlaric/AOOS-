import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "activity-log/" equivalent) — `/property/activity` retired into the new top-level Aktivitas hub (`/activity`, no `/property` prefix — this app has never had vertical-prefixed routing; real `ActivityLogClient` untouched). */
export default function ActivityLogPage(): never {
  redirect("/activity");
}
