import { redirect } from "next/navigation";

/**
 * EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68) — `Automation` sidebar item's real destination.
 * This codebase has NO real Advisor/Copilot/Guarded Autopilot/Autonomous mode selector or per-action
 * permission table anywhere (investigated — no operating-mode-per-agent backing beyond the real
 * DEV/LIVE tenant `mode` toggle) — the mockup's full Automation page is real future work.
 *
 * Phase 54 correction: this used to redirect to `?tab=agen` (agent identity/role grid — not an
 * automation control at all). The actual closest real automation guardrail is `ObjectiveClient`'s
 * "Automasi Campaign" card (`PropertyObjectiveForm`'s real `autoPublishCampaign` /
 * `maxBudgetIncreasePct` fields, PATCHed via `/api/property-objective/auto-publish-settings`) —
 * it literally controls whether Samantha auto-publishes campaigns and how much budget she may move
 * without approval. That card lives on `SettingsHubClient`'s "objective" tab, which is already this
 * hub's own `DEFAULT_TAB`, so this redirects to bare `/settings`. The other real automation-adjacent
 * control — the DEV/LIVE `mode` toggle — lives one tab away on "koneksi" and stays reachable from
 * there; it isn't the redirect target because it gates ALL Meta-mutating actions tenant-wide, not
 * campaign automation specifically.
 */
export default function AutomationPage(): never {
  redirect("/settings");
}
