import type { CampaignView, HistoryPoint } from "./campaigns";
import type { CreativeGalleryItem } from "./creative-health";
import { presentLabel, presentText } from "./presentation";

/**
 * Budget tab — pure mapper, no JSX. Mirrors `creative-health.ts` / `lead-quality.ts` conventions:
 * every field here is a real function of `item`/`history`/`gallery`, honest `undefined`/gap when
 * the real backing data doesn't exist, no fabricated numbers.
 *
 * Decision vocabulary note: the real backend decision (`SamanthaDecisionDto.decision`) is one of
 * `NO_ACTION | MONITOR | REQUEST_KAI_CREATIVE | SCALE | KEEP | REVIEW | REFRESH | FIX | PAUSE` (see
 * `apps/aaos-api/src/modules/campaign-health/domain/decision.ts`) — NOT a mockup's invented
 * `SCALE/HOLD/REDUCE/REALLOCATE/WAIT_FOR_DATA/FIX_TRACKING_FIRST/REFRESH_CREATIVE_FIRST` vocabulary.
 * `POSTURE_BY_DECISION` buckets the real decision into a presentational posture honestly:
 *  - `SCALE` -> `"SCALE"` (real positive signal).
 *  - `NO_ACTION` / `MONITOR` / `KEEP` -> `"HOLD"` (no change needed).
 *  - `PAUSE` / `FIX` / `REVIEW` / `REFRESH` / `REQUEST_KAI_CREATIVE` -> `"ATTENTION"` (needs
 *    attention — not a budget-scale moment, whether the issue is severe like PAUSE/FIX or milder
 *    like REVIEW/REFRESH/REQUEST_KAI_CREATIVE; none of these are ever a real reason to add spend).
 *  - No real assessment at all -> `"UNKNOWN"`.
 * Any future real `RecommendedActionType` this table doesn't recognize falls back to `"ATTENTION"`
 * (never a silent `"HOLD"`) — the same "unmapped real signal defaults to the cautious option, never
 * a silent do-nothing" discipline `decision.ts`'s own `DEFAULT_ROOT_CAUSE_DECISION` documents.
 */
export type BudgetPosture = "SCALE" | "HOLD" | "ATTENTION" | "UNKNOWN";

const POSTURE_BY_DECISION: Record<string, BudgetPosture> = {
  SCALE: "SCALE",
  NO_ACTION: "HOLD",
  MONITOR: "HOLD",
  KEEP: "HOLD",
  PAUSE: "ATTENTION",
  FIX: "ATTENTION",
  REVIEW: "ATTENTION",
  REFRESH: "ATTENTION",
  REQUEST_KAI_CREATIVE: "ATTENTION",
};

const POSTURE_TITLE: Record<BudgetPosture, string> = {
  SCALE: "Scale — Samantha melihat sinyal positif untuk menambah budget",
  HOLD: "Hold — tidak ada perubahan budget yang diperlukan",
  ATTENTION: "Perlu perhatian — bukan saat yang tepat untuk menambah budget",
  UNKNOWN: "Menunggu assessment Samantha",
};

export interface SamanthaBudgetDecisionModel {
  readonly hasDecision: boolean;
  readonly posture: BudgetPosture;
  readonly postureTitle: string;
  readonly decisionLabel: string;
  readonly reason: string;
  readonly confidencePct?: number;
  readonly currentBudget?: number;
  /** Honest — never a fabricated target amount/percentage (no real BudgetDecisionEngine target exists). */
  readonly recommendationNote: string;
  readonly reviewAfterHours?: number;
  readonly reviewNote: string;
  readonly rollbackConditions: readonly string[];
  /** Honest gap — `evaluateAutomationPolicy` is real but not wired to any endpoint/tenant config. */
  readonly allowedChangeNow: string;
}

export function mapSamanthaBudgetDecision(item: CampaignView): SamanthaBudgetDecisionModel {
  const decision = item.assessment?.decision;
  const posture: BudgetPosture = decision
    ? (POSTURE_BY_DECISION[decision.decision] ?? "ATTENTION")
    : "UNKNOWN";
  return {
    hasDecision: !!decision,
    posture,
    postureTitle: POSTURE_TITLE[posture],
    decisionLabel: decision ? presentLabel(decision.decision) : "Belum ada rekomendasi",
    reason: decision
      ? presentText(decision.reason)
      : "Assessment Samantha belum tersedia untuk campaign ini.",
    confidencePct: decision ? Math.round(decision.confidence * 100) : undefined,
    currentBudget: item.budget,
    recommendationNote:
      posture === "SCALE"
        ? "Samantha merekomendasikan scaling, tetapi nominal/persentase rekomendasi belum dihitung sistem — tidak ada target budget yang bisa ditampilkan dengan jujur."
        : posture === "ATTENTION"
          ? "Samantha tidak merekomendasikan menambah budget selama kondisi campaign seperti ini."
          : posture === "HOLD"
            ? "Samantha merekomendasikan mempertahankan budget saat ini."
            : "Belum ada rekomendasi budget dari Samantha untuk campaign ini.",
    reviewAfterHours: decision?.monitoringPlan.reviewAfterHours,
    reviewNote: decision
      ? `${decision.monitoringPlan.reviewAfterHours} jam setelah assessment ini; belum menjadi jadwal pasti (tidak ada timestamp assessment yang tersimpan).`
      : "Belum ada monitoring plan.",
    rollbackConditions: decision?.monitoringPlan.rollbackConditions ?? [],
    allowedChangeNow:
      "Belum terhubung — automation policy per tenant (mode/minimum confidence/allowed actions) belum dikonfigurasi di codebase ini, jadi tidak ada perubahan budget otomatis yang bisa dijamin berjalan.",
  };
}

export interface BudgetPacingModel {
  readonly hasData: boolean;
  readonly windowDays: number;
  readonly periodTarget?: number;
  readonly actualSpend?: number;
  readonly pacingPct?: number;
  readonly projectedSpend?: number;
  readonly status: "On Track" | "Overspend" | "Underspend" | "Belum Cukup Data";
  readonly caveat: string;
}

/**
 * No real campaign schedule/period-boundary field exists anywhere on `CampaignView`/
 * `PortfolioCampaign`/`CampaignSummaryDto` (verified — no start/end date field). "Period" here is
 * therefore honestly the same rolling last-(up to 7)-days window the existing Budget tab already
 * uses for its "Next 7 days · estimate" stat, never a fabricated calendar-month target.
 *
 * Status thresholds (±10% of the configured daily-budget pace) are a presentation choice disclosed
 * here, not a backend signal — mirrors `lead-quality.ts`'s `buildSamanthaLeadQualityAnalysis`
 * convention of self-disclosing its own bucketing thresholds rather than hiding them.
 */
export function computeBudgetPacing(
  item: CampaignView,
  history?: readonly HistoryPoint[],
): BudgetPacingModel {
  const window = (history ?? []).slice(-7);
  const windowDays = window.length;
  const caveat =
    "Dihitung dari snapshot spend harian terakhir × budget harian saat ini — bukan periode kalender campaign (tidak tersedia di data campaign ini).";
  if (!windowDays || !item.budget) {
    return { hasData: false, windowDays, status: "Belum Cukup Data", caveat };
  }
  const actualSpend = window.reduce((sum, p) => sum + p.spend, 0);
  const periodTarget = item.budget * windowDays;
  const pacingPct = periodTarget > 0 ? (actualSpend / periodTarget) * 100 : undefined;
  const average = actualSpend / windowDays;
  const projectedSpend = average * 7;
  const status: BudgetPacingModel["status"] =
    pacingPct === undefined
      ? "Belum Cukup Data"
      : pacingPct > 110
        ? "Overspend"
        : pacingPct < 90
          ? "Underspend"
          : "On Track";
  return {
    hasData: true,
    windowDays,
    periodTarget,
    actualSpend,
    pacingPct,
    projectedSpend,
    status,
    caveat,
  };
}

export interface PotentialWasteModel {
  readonly fatiguedCount: number;
  /** `undefined` when there are no Fatigued creatives — an honest gap, not a fabricated 0. */
  readonly fatiguedSpend?: number;
}

/**
 * The ONE real Potential Waste category this codebase can honestly support today: real spend
 * (`ad.metrics.spend`, already summed by `creative-health.ts`'s `buildCreativeGallery` into
 * `CreativeGalleryItem.spend`) on creatives whose real Creative Health status is `Fatigued`. Every
 * other waste category the mockup shows (low-quality-lead spend, spend-without-qualified-result,
 * tracking-limited spend) has no real backing data source and must stay an honest gap — this
 * function deliberately does not attempt them.
 */
export function computeFatiguedSpendWaste(
  gallery: readonly CreativeGalleryItem[],
): PotentialWasteModel {
  const fatigued = gallery.filter((g) => g.status === "Fatigued");
  return {
    fatiguedCount: fatigued.length,
    fatiguedSpend: fatigued.length ? fatigued.reduce((sum, g) => sum + g.spend, 0) : undefined,
  };
}

/**
 * Real, computed-from-real-data insights only, gated by real sufficiency checks — mirrors
 * `leadQualityInsights`/`creativeInsights`'s gating convention. Returns `[]` (honest empty state)
 * rather than a fabricated insight when the backing data isn't sufficient.
 */
export function budgetInsights(
  pacing: BudgetPacingModel,
  decision: SamanthaBudgetDecisionModel,
): string[] {
  const insights: string[] = [];
  if (pacing.hasData && pacing.pacingPct !== undefined) {
    insights.push(
      `Pacing ${pacing.windowDays} hari terakhir: ${pacing.pacingPct.toFixed(0)}% dari budget yang dikonfigurasi (${pacing.status}).`,
    );
  }
  if (decision.hasDecision && decision.confidencePct !== undefined) {
    insights.push(`Confidence assessment Samantha saat ini: ${decision.confidencePct}%.`);
  }
  return insights;
}
