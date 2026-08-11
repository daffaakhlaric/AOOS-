import type { AdAccount } from "@aos/meta-ads-connector";

/**
 * The Backward Planning Algorithm (spec), split per the package report's "backward-planning
 * placement" resolution into two independently-testable pieces, since `CreateObjective`'s input
 * has no `AdAccount` to derive `avg_rph_d3` from:
 *
 *  (a) `calculateD3Needed` — pure, needs only the Objective's target + config
 *      `hotLeadConversionRate`. Usable at `CreateObjective`/`GetObjectiveStatus` time, purely
 *      informational (it does not gate objective creation).
 *  (b) `calculateAverageRphD3` + `calculateBudgetPlanning` — need a real `AdAccount`'s ad
 *      performance data, so they are wired into `ForecastObjective` (the use case that already
 *      receives an `AdAccount`), not `CreateObjective`. See package report for the exact call
 *      site.
 */

/** `Math.ceil(targetHotLeads / hotLeadConversionRate)` — rounds UP: at least this many D3 leads are needed (spec: "d3_needed = target_hot_leads / hot_lead_rate", pinned test `target=50, rate=0.18 → d3_needed=278`). */
export function calculateD3Needed(targetHotLeads: number, hotLeadConversionRate: number): number {
  if (hotLeadConversionRate <= 0) {
    return 0;
  }
  return Math.ceil(targetHotLeads / hotLeadConversionRate);
}

/**
 * The mean `Rp/D3` across every Ad in `adAccount` that has a defined rate (`Ad.metrics.rphD3`
 * is `null` for ads with 0 D3s — see `@aos/meta-ads-connector`'s `Rph`). Returns `0` for a
 * zero-campaigns `AdAccount` or one where no ad has a defined `rphD3` (spec edge case:
 * "adAccount with 0 campaigns") — never `NaN`.
 */
export function calculateAverageRphD3(adAccount: AdAccount): number {
  const rates: number[] = [];
  for (const campaign of adAccount.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        if (ad.metrics.rphD3.isDefined()) {
          rates.push(ad.metrics.rphD3.value as number);
        }
      }
    }
  }
  if (rates.length === 0) {
    return 0;
  }
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

export interface BudgetPlanningOutput {
  readonly budgetNeeded: number;
  readonly recommendedBudget: number;
}

/**
 * `budget_needed = d3_needed * avg_rph_d3`, `recommended_budget = budget_needed *
 * budgetBufferFactor` (spec: 15% buffer, default `1.15`). Both rounded up (`Math.ceil`) to whole
 * Rupiah — a recommended budget should never under-cover the computed need due to fractional
 * truncation.
 */
export function calculateBudgetPlanning(
  d3Needed: number,
  avgRphD3: number,
  budgetBufferFactor: number,
): BudgetPlanningOutput {
  const budgetNeeded = Math.ceil(d3Needed * avgRphD3);
  const recommendedBudget = Math.ceil(budgetNeeded * budgetBufferFactor);
  return { budgetNeeded, recommendedBudget };
}
