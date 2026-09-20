import { redirect } from "next/navigation";

/**
 * EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68) — `Automation` sidebar item's real destination.
 * This codebase has NO real Advisor/Copilot/Guarded Autopilot/Autonomous mode selector or per-action
 * permission table anywhere (investigated — no operating-mode-per-agent backing beyond the real
 * DEV/LIVE tenant `mode` toggle) — the mockup's full Automation page is real future work. The closest
 * existing real content is `SettingsHubClient`'s own "Agen" tab (agent identity/role grid), so this
 * item honestly redirects there instead of a dead link or a fabricated placeholder that looks like a
 * real automation-mode UI. Same real `redirect()`-only pattern this app already established for the
 * old `/meta-ads/abtesting` retirement.
 */
export default function AutomationPage(): never {
  redirect("/settings?tab=agen");
}
