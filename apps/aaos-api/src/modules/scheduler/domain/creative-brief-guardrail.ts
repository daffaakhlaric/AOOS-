import type { TenantMode } from "../../mode-guard/mode-guard.service.js";

/**
 * `decideCreativeBriefGuardrail` (AAOS LOOP UPGRADE, Sprint 8a — Prompt 19 Step 3) — pure,
 * synchronous, no I/O, the SAME "pure decision function over already-resolved real inputs" shape
 * `evaluateFatigue`/`evaluateNeedCreative`/`shouldCreateNewCampaign` already establish in this
 * module. The single most important function in this dispatch — see this repo's coordinator note
 * ("CRITICAL SAFETY REQUIREMENT") and this function's own test file for the explicit proof that
 * `autoApproveEnabled = false` (the real DB column default, `047_creative_packages_auto_loop.sql`)
 * NEVER results in `status: "DRAFT"` (i.e. never skips human review).
 *
 * The spec's own literal guardrail chain:
 *   1. `max_auto_briefs_per_day` (default 5) belum kelampauan hari ini -> else SKIP entirely.
 *   2. Mode DEV -> insert PENDING_REVIEW (needs human approve before Step 4).
 *   3. Mode LIVE AND toggle "Auto-approve creative brief" ON -> proceed automatically (this
 *      dispatch's own honest scope note: "proceed" here means the row lands as `DRAFT` — the SAME
 *      real state a human-approved brief reaches today, i.e. "ready to send to Kai", NOT an actual
 *      call to Kai/Kie AI — Step 4 itself is out of scope for Sprint 8a and no code anywhere in this
 *      dispatch invokes it. `creative-package.ts`'s own real invariant, "nothing transitions a
 *      package out of DRAFT except an explicit POST .../generate", is therefore fully preserved: an
 *      auto-approved brief still requires a human's explicit "Kirim ke Kai" click before any real
 *      Kie AI spend happens, exactly like a manually-created brief).
 *   4. Mode LIVE AND toggle OFF -> same as DEV, PENDING_REVIEW.
 *
 * Order matters: the daily cap is checked FIRST and short-circuits everything else (a maxed-out
 * tenant gets zero new auto-loop rows today, regardless of mode/toggle) — matches the spec's own
 * "GUARDRAIL — cek dulu sebelum insert" ordering.
 */

export interface CreativeBriefGuardrailInput {
  readonly mode: TenantMode;
  /** Real, resolved `property_objectives.auto_approve_creative_brief` for this tenant (or the real DB default, `false`, when no row exists yet) — see `047_creative_packages_auto_loop.sql`'s own doc for why `false` is the honest fallback, never `true`. */
  readonly autoApproveEnabled: boolean;
  /** Real count of `creative_packages` rows with `source = 'auto_loop'` created for this tenant since the start of today (UTC), BEFORE this potential new insert. */
  readonly autoBriefsToday: number;
  /** Real, resolved `property_objectives.max_auto_briefs_per_day` for this tenant (or the real DB default, `5`). */
  readonly maxAutoBriefsPerDay: number;
}

export type CreativeBriefGuardrailDecision =
  | {
      readonly allowed: true;
      /** `DRAFT` (LIVE + toggle ON, proceeds without review) or `PENDING_REVIEW` (every other real case). */
      readonly status: "DRAFT" | "PENDING_REVIEW";
      readonly reason: string;
    }
  | {
      readonly allowed: false;
      readonly reason: string;
    };

export function decideCreativeBriefGuardrail(
  input: CreativeBriefGuardrailInput,
): CreativeBriefGuardrailDecision {
  const { mode, autoApproveEnabled, autoBriefsToday, maxAutoBriefsPerDay } = input;

  if (autoBriefsToday >= maxAutoBriefsPerDay) {
    return {
      allowed: false,
      reason: `Sudah ${String(autoBriefsToday)} auto-brief hari ini (batas ${String(maxAutoBriefsPerDay)}) — brief baru dilewati.`,
    };
  }

  if (mode === "LIVE" && autoApproveEnabled) {
    return {
      allowed: true,
      status: "DRAFT",
      reason:
        "Mode LIVE dan toggle Auto-approve creative brief aktif — brief langsung DRAFT, siap dikirim ke Kai (masih butuh klik manual, Step 4 di luar scope dispatch ini).",
    };
  }

  return {
    allowed: true,
    status: "PENDING_REVIEW",
    reason:
      mode === "DEV"
        ? "Mode DEV — brief butuh approve manual sebelum lanjut."
        : "Mode LIVE tapi toggle Auto-approve creative brief OFF — brief butuh approve manual sebelum lanjut.",
  };
}
