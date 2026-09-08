import type { TenantMode } from "../../mode-guard/mode-guard.service.js";

/**
 * `decideCampaignPublishGuardrail` (AAOS LOOP UPGRADE, Sprint 8c — Prompt 19 Step 5) — pure,
 * synchronous, no I/O, the SAME "pure decision function over already-resolved real inputs" shape
 * `decideCreativeBriefGuardrail`/`evaluateFatigue`/`evaluateNeedCreative`/`shouldCreateNewCampaign`
 * already establish in this module. The single most important function in this dispatch — see this
 * repo's coordinator note ("SINGLE HIGHEST-STAKES DISPATCH") and this function's own test file for
 * the explicit proof that BOTH real safety-critical inputs are honored end to end:
 *   1. `autoPublishEnabled = false` (the real DB column default, `048_campaign_auto_publish.sql`)
 *      NEVER results in `status: "ACTIVE"` (i.e. never skips human review) — same "SAFETY DEFAULT"
 *      test naming convention/rigor as `creative-brief-guardrail.spec.ts`'s own precedent.
 *   2. A budget increase exceeding `maxBudgetIncreasePct` ALWAYS returns `status: "PENDING_REVIEW"`,
 *      even when `autoPublishEnabled = true` AND `mode = "LIVE"` — the guardrail actually BLOCKS,
 *      never merely logs/warns (the user's own literal checklist item).
 *
 * The spec's own literal guardrail chain (Step 5b/5c):
 *   a. `hasActiveCampaign = true` (an existing campaign for this listing already exists) ALWAYS
 *      returns `PENDING_REVIEW`, regardless of every other input. HONEST, DOCUMENTED SCOPE LIMIT
 *      (not in the spec's own literal text, added by this dispatch's own investigation): no real
 *      "increase an EXISTING campaign's budget" Meta API mutation exists anywhere in
 *      `@aos/meta-ads-connector` today (verified directly — only `CreateCampaign` exists, no
 *      `UpdateCampaignBudget`/equivalent). Building a brand-new, unverified real-money-mutating Meta
 *      API call in this same dispatch — with no existing precedent to reuse or test against — is
 *      exactly the kind of thing this dispatch's own coordinator note says to STOP rather than guess
 *      at ("a real budget-delta calculation you can't honestly source"). This function therefore
 *      never signals `ACTIVE`/`DRAFT` for that case at all — every listing with an existing active
 *      campaign is honestly routed to human review, never a fabricated/guessed publish.
 *   b. Mode DEV → `DRAFT` (`campaignsService.createPropertyCampaign`'s own real DEV path makes ZERO
 *      real Meta calls — see that method's own doc — matching the spec's "aman, tidak spend").
 *   c. Mode LIVE AND `autoPublishEnabled` OFF → `PENDING_REVIEW`.
 *   d. Mode LIVE AND `autoPublishEnabled` ON AND `budgetIncreasePct` (when present) exceeds
 *      `maxBudgetIncreasePct` → `PENDING_REVIEW` (the guardrail actually blocking).
 *   e. Mode LIVE AND `autoPublishEnabled` ON AND within the guardrail (or no real budget delta to
 *      guard, i.e. a brand-new campaign with no prior budget) → `ACTIVE` (publish for real).
 *
 * Order matters, same discipline `decideCreativeBriefGuardrail` already establishes: the
 * `hasActiveCampaign` scope-limit check runs FIRST and short-circuits everything else.
 */

export interface CampaignPublishGuardrailInput {
  readonly mode: TenantMode;
  /** Real, resolved `property_objectives.auto_publish_campaign` for this tenant (or the real DB default, `false`, when no row exists yet). */
  readonly autoPublishEnabled: boolean;
  /**
   * Real, resolved `matched.hasActiveCampaign` for this listing (`SchedulerService`'s own already-
   * computed per-listing signal) — `true` means an existing Meta campaign already exists for this
   * listing, which this function can never safely auto-publish a budget change for (see this
   * function's own doc, point (a)).
   */
  readonly hasActiveCampaign: boolean;
  /**
   * The real, verdict-driven daily budget increase percentage this campaign action would represent,
   * when honestly computable. `undefined` for a brand-new campaign (no prior budget exists to
   * compute an "increase" from) — treated as 0% (no guardrail violation possible).
   */
  readonly budgetIncreasePct?: number;
  /** Real, resolved `property_objectives.max_budget_increase_pct` for this tenant (or the real DB default, `20`). */
  readonly maxBudgetIncreasePct: number;
}

export type CampaignPublishGuardrailDecision =
  | {
      readonly allowed: true;
      /** `ACTIVE` (LIVE + auto-publish ON + within guardrail, publishes for real) or `DRAFT` (DEV mode, real DEV-safe preview). */
      readonly status: "ACTIVE" | "DRAFT";
      readonly reason: string;
    }
  | {
      readonly allowed: false;
      readonly status: "PENDING_REVIEW";
      readonly reason: string;
    };

export function decideCampaignPublishGuardrail(
  input: CampaignPublishGuardrailInput,
): CampaignPublishGuardrailDecision {
  const { mode, autoPublishEnabled, hasActiveCampaign, budgetIncreasePct, maxBudgetIncreasePct } =
    input;

  if (hasActiveCampaign) {
    return {
      allowed: false,
      status: "PENDING_REVIEW",
      reason:
        "Listing ini sudah punya campaign aktif — belum ada jalur real untuk menaikkan budget campaign yang sudah ada secara otomatis, butuh approve manual.",
    };
  }

  if (mode === "DEV") {
    return {
      allowed: true,
      status: "DRAFT",
      reason: "Mode DEV — campaign dibuat sebagai draft, tidak ada spend real.",
    };
  }

  if (!autoPublishEnabled) {
    return {
      allowed: false,
      status: "PENDING_REVIEW",
      reason:
        "Mode LIVE tapi toggle Auto-publish campaign OFF — butuh approve manual sebelum publish.",
    };
  }

  if (budgetIncreasePct !== undefined && budgetIncreasePct > maxBudgetIncreasePct) {
    return {
      allowed: false,
      status: "PENDING_REVIEW",
      reason: `Kenaikan budget ${String(budgetIncreasePct)}% melebihi batas max_budget_increase_pct (${String(maxBudgetIncreasePct)}%) — tetap staged jadi draft, butuh approve manual walau mode LIVE.`,
    };
  }

  return {
    allowed: true,
    status: "ACTIVE",
    reason:
      "Mode LIVE, toggle Auto-publish campaign aktif, dan dalam guardrail max_budget_increase_pct — publish langsung.",
  };
}
