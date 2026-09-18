import type { FeasibilityResult } from "../../growth-objectives/domain/feasibility.js";

import type { CampaignBlueprint } from "./campaign-blueprint.js";
import type { ListingReadinessResult } from "./listing-readiness.js";

/**
 * EYVRA — SAMANTHA V2 Phase 25 (PROMPT 35 — Campaign Preflight). Pure, deterministic go/no-go
 * verdict, computed BEFORE any real Meta API call — combines three already-computed real results:
 *   - `ListingReadinessResult` (this phase's `listing-readiness.ts`, PROMPT 33).
 *   - `FeasibilityResult` (Phase 1's `assessFeasibility`, PROMPT 35's own "budget valid" bullet) —
 *     reused directly from `growthObjective.forecast.feasibility`, NEVER recomputed here (this
 *     phase's "reuse, never duplicate" discipline).
 *   - `CampaignBlueprint` (this phase's `campaign-blueprint.ts`, PROMPT 32) — its own `warnings`
 *     double as this preflight's "creative ready"/"geo valid"/"budget valid" completeness signal.
 *
 * HONEST SCOPE: the raw spec's PROMPT 35 bullet list also names checks this codebase has no real
 * data source for at all — Meta account connection/ad-account/page/Instagram/billing state, special
 * ad category, placement validity, tracking/UTM readiness, tenant permission, automation policy.
 * None of those are fabricated here; `CAMPAIGN_PREFLIGHT_SKIPPED_CHECKS` documents them explicitly,
 * same "never invent, always disclose" discipline `listing-readiness.ts`'s `skippedChecks` follows.
 * A future phase (PROMPT 36+) that actually resolves a `MetaAdsConnector` before creating anything
 * is the right place to add those as real checks.
 */

export const CAMPAIGN_PREFLIGHT_SKIPPED_CHECKS: readonly string[] = [
  "metaAccountConnected",
  "adAccountActive",
  "pageConfigured",
  "instagramIfRequired",
  "billingAccountState",
  "specialAdCategory",
  "placementValid",
  "trackingUtmReady",
  "tenantPermission",
  "automationPolicy",
];

/** `FeasibilityStatus` values this preflight still lets through as a real "proceed, but watch it" — mirrors `assessFeasibility`'s own philosophy that `AT_RISK` is a real, actionable status, not a hard stop. Only `UNLIKELY`/`INSUFFICIENT_DATA` block. */
const PASSABLE_FEASIBILITY_STATUSES = new Set(["ACHIEVABLE", "AGGRESSIVE", "AT_RISK"]);

export type CampaignPreflightCheckName =
  "listingReadiness" | "feasibility" | "blueprintCompleteness";

export interface CampaignPreflightCheck {
  readonly name: CampaignPreflightCheckName;
  readonly passed: boolean;
  readonly reasons: readonly string[];
}

export interface CampaignPreflightResult {
  readonly ready: boolean;
  readonly checks: readonly CampaignPreflightCheck[];
  readonly warnings: readonly string[];
  readonly blockingErrors: readonly string[];
  /** See this file's header doc — always `CAMPAIGN_PREFLIGHT_SKIPPED_CHECKS` today. */
  readonly skippedChecks: readonly string[];
}

export interface CampaignPreflightInput {
  readonly listingReadiness: ListingReadinessResult;
  readonly blueprint: CampaignBlueprint;
  /** `growthObjective.forecast?.feasibility` — `undefined` when the objective hasn't been analyzed yet (honestly blocks preflight, never assumed feasible). */
  readonly feasibility?: FeasibilityResult;
}

function checkListingReadinessGate(readiness: ListingReadinessResult): CampaignPreflightCheck {
  return {
    name: "listingReadiness",
    passed: readiness.ready,
    reasons: readiness.blockingIssues,
  };
}

function checkFeasibilityGate(
  feasibility: FeasibilityResult | undefined,
  warnings: string[],
): CampaignPreflightCheck {
  if (feasibility === undefined) {
    return {
      name: "feasibility",
      passed: false,
      reasons: [
        "Growth objective belum dianalisa (POST /growth-objectives/:id/analyze) — feasibility belum tersedia untuk preflight.",
      ],
    };
  }
  const passed = PASSABLE_FEASIBILITY_STATUSES.has(feasibility.status);
  if (passed && feasibility.status === "AT_RISK") {
    warnings.push(...feasibility.reasons);
  }
  return {
    name: "feasibility",
    passed,
    reasons: feasibility.reasons,
  };
}

function checkBlueprintCompleteness(blueprint: CampaignBlueprint): CampaignPreflightCheck {
  const reasons: string[] = [];
  if (blueprint.destination === undefined) {
    reasons.push("Blueprint belum punya destination (nomor WhatsApp) yang valid.");
  }
  if (blueprint.adSet.dailyBudgetIdr === undefined) {
    reasons.push("Blueprint belum punya proyeksi budget harian yang valid.");
  }
  if (blueprint.creativeStrategy.formats.length === 0) {
    reasons.push("Blueprint belum punya format creative (butuh minimal 1 foto usable).");
  }
  return { name: "blueprintCompleteness", passed: reasons.length === 0, reasons };
}

export function assessCampaignPreflight(input: CampaignPreflightInput): CampaignPreflightResult {
  const { listingReadiness, blueprint, feasibility } = input;
  const warnings: string[] = [];

  const checks: readonly CampaignPreflightCheck[] = [
    checkListingReadinessGate(listingReadiness),
    checkFeasibilityGate(feasibility, warnings),
    checkBlueprintCompleteness(blueprint),
  ];

  const blockingErrors = checks.filter((check) => !check.passed).flatMap((check) => check.reasons);

  return {
    ready: checks.every((check) => check.passed),
    checks,
    warnings,
    blockingErrors,
    skippedChecks: CAMPAIGN_PREFLIGHT_SKIPPED_CHECKS,
  };
}
