import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/objective` retired into the new Settings page's "objective" tab (real Settings rebuild, including this tab, is a later sprint — Prompt 8; real `ObjectiveClient` untouched). */
export default function ObjectivePage(): never {
  redirect("/settings?tab=objective");
}
