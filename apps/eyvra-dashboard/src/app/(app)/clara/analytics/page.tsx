import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "jessy/analytics" equivalent) — `/clara/analytics` retired into `/dashboard` (real `ClaraAnalyticsClient` untouched). */
export default function ClaraAnalyticsPage(): never {
  redirect("/dashboard");
}
