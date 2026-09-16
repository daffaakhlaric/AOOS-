import { formatIdr } from "@/lib/formatters";
import { daysElapsedInMonth, daysInMonth } from "@/lib/monthProgress";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import { aggregateCampaign } from "./campaignInsightMath";
import styles from "./BudgetTracker.module.css";

export interface BudgetTrackerProps {
  readonly campaigns: readonly CampaignSummaryDto[];
  /** Injectable for tests only — defaults to `new Date()`. */
  readonly now?: Date;
}

export type PaceTone = "over" | "under" | "on-pace";

/**
 * Real pace tone: compares actual spend against the real `dailyBudget`-implied spend expected by
 * today (`dailyBudget * daysElapsedInMonth`), +/- 10% tolerance. `"over"` when spending faster than
 * the set daily budget would imply, `"under"` when meaningfully behind it, `"on-pace"` otherwise.
 */
export function paceTone(spend: number, expectedByNow: number): PaceTone {
  if (expectedByNow <= 0) {
    return "on-pace";
  }
  const ratio = spend / expectedByNow;
  if (ratio > 1.1) {
    return "over";
  }
  if (ratio < 0.9) {
    return "under";
  }
  return "on-pace";
}

const PACE_LABEL: Record<PaceTone, string> = {
  over: "Pacing di atas budget harian",
  under: "Pacing di bawah budget harian",
  "on-pace": "Pacing sesuai budget harian",
};

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — bottom-strip "Anggaran" card (spec: "per-campaign spend-vs-budget
 * progress bars").
 *
 * ORIGINAL FINDING (still true for a real per-campaign lifetime CAP — see below): no real
 * per-campaign budget-cap field exists anywhere in this codebase. Campaign Page Rebuild v2
 * (Prompt 5) revisits this with ONE real field that has since become available: real, already-pulled
 * `AdSetSummaryDto.dailyBudget` (summed per-campaign via `aggregateCampaign`, the SAME real
 * ABO/CBO-aware sum `UnifiedCampaignTable`'s "Daily Budget" column already shows — added for the
 * AdAdvisor-style table earlier this same rebuild). A real daily budget × the real number of
 * elapsed/total calendar days in the current month gives an honest ESTIMATED monthly budget — not
 * Meta's real lifetime cap (which still doesn't exist as a field), so the UI labels it "estimasi"
 * throughout and never claims it's a real cap. Campaigns with a genuinely 0 real `dailyBudget`
 * (a fresh CBO campaign this table's own ABO/CBO fallback still can't resolve, or one with no ad
 * sets at all) fall back to the original honest spend-only row, same as before.
 */
export function BudgetTracker({ campaigns, now }: BudgetTrackerProps): React.ReactElement {
  const today = now ?? new Date();
  const elapsedDays = daysElapsedInMonth(today);
  const totalDays = daysInMonth(today);

  const rows = campaigns
    .map((campaign) => {
      const aggregate = aggregateCampaign(campaign);
      const estimatedMonthlyBudget =
        aggregate.dailyBudget > 0 ? aggregate.dailyBudget * totalDays : null;
      const expectedByNow = aggregate.dailyBudget > 0 ? aggregate.dailyBudget * elapsedDays : null;
      return {
        campaign,
        spend: aggregate.spend,
        dailyBudget: aggregate.dailyBudget,
        estimatedMonthlyBudget,
        expectedByNow,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
  const hasAnyEstimate = rows.some((row) => row.estimatedMonthlyBudget !== null);

  return (
    <section data-testid="budget-tracker" className={styles.section}>
      <h3 className={styles.title}>Anggaran</h3>
      {hasAnyEstimate ? (
        <p className={styles.honestNote}>
          Progress bar di bawah adalah ESTIMASI (daily budget real × hari berjalan bulan ini) — Meta
          tidak menyediakan field cap bulanan per-campaign yang real, jadi ini bukan batas resmi
          dari Meta.
        </p>
      ) : (
        <p className={styles.honestNote}>
          Progress bar spend-vs-budget per-campaign belum tersedia untuk campaign di bawah — tidak
          ada real daily budget per-campaign (ad set belum di-set atau campaign belum punya ad set).
          Di bawah ini real spend per-campaign tanpa bar fabrikasi.
        </p>
      )}
      <p className={styles.total}>Total Spend: {formatIdr(totalSpend)}</p>
      {rows.length > 0 ? (
        <ul className={styles.list}>
          {rows.map((row) => {
            if (row.estimatedMonthlyBudget === null || row.expectedByNow === null) {
              return (
                <li key={row.campaign.id} className={styles.row}>
                  <span className={styles.name}>{row.campaign.name}</span>
                  <span className={styles.spend}>{formatIdr(row.spend)}</span>
                </li>
              );
            }
            const ratio = row.spend / row.estimatedMonthlyBudget;
            const percent = Math.min(ratio * 100, 100);
            const tone = paceTone(row.spend, row.expectedByNow);
            return (
              <li key={row.campaign.id} className={styles.barRow}>
                <div className={styles.barTopLine}>
                  <span className={styles.name}>{row.campaign.name}</span>
                  <span className={styles.spend}>
                    {formatIdr(row.spend)} / ~{formatIdr(row.estimatedMonthlyBudget)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  data-testid={`budget-bar-${row.campaign.id}`}
                  aria-valuenow={Math.round(percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className={styles.barTrack}
                >
                  <div
                    className={`${styles.barFill} ${styles[`barFill${capitalize(toneClass(tone, ratio))}`]}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span
                  data-testid={`pace-${row.campaign.id}`}
                  data-pace={tone}
                  className={`${styles.paceLabel} ${styles[`pace${capitalize(toneClass(tone, ratio))}`]}`}
                >
                  {ratio > 1 ? "⚠ Estimasi terlampaui — " : ""}
                  {PACE_LABEL[tone]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function toneClass(tone: PaceTone, ratio: number): "over" | "under" | "onPace" {
  if (ratio > 1 || tone === "over") {
    return "over";
  }
  if (tone === "under") {
    return "under";
  }
  return "onPace";
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

export default BudgetTracker;
