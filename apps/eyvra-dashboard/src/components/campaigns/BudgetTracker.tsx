import { formatIdr } from "@/lib/formatters";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import styles from "./BudgetTracker.module.css";

export interface BudgetTrackerProps {
  readonly campaigns: readonly CampaignSummaryDto[];
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — bottom-strip "Anggaran" card (spec: "per-campaign spend-vs-budget
 * progress bars").
 *
 * REAL DATA-AVAILABILITY FINDING (re-investigated for this dispatch, same conclusion `02c475f`'s
 * own Sprint 2 investigation already reached and `AuditClient`'s honest note in the old "Anggaran"
 * tab already documented): NO real per-campaign daily/lifetime budget-cap field exists anywhere in
 * this codebase — not on `CampaignSummaryDto`, `AdSetSummaryDto`, `aaos-api`'s
 * `AdAccountResponseDto`/`CampaignResponseDto`, nor anywhere in `@aos/meta-ads-connector`'s
 * `Campaign`/`AdSet` domain entities (confirmed by a fresh repo-wide search for `budget`/
 * `dailyBudget` across `packages/meta-ads-connector` and `apps/aaos-api`). The only real budget
 * number anywhere is `property_objectives.budget_allocation` / `objectives.budget_allocation` — a
 * single MONTHLY, TENANT-WIDE figure with no per-campaign breakdown.
 *
 * A progress bar needs a real per-campaign CAP to measure spend against — with none available,
 * rendering one would mean either fabricating a cap or silently dividing real spend by an invented
 * number, both violating this task's "never fabricate a budget number" rule. This card instead
 * shows the real, honest substitute: each campaign's real spend (no bar, no fabricated percentage)
 * plus an explicit note on the real gap — the same honest-degrade shape `MetricsTab.tsx`'s "Spend
 * vs Revenue" empty state and the pre-rebuild "Anggaran" tab's own note already established.
 */
export function BudgetTracker({ campaigns }: BudgetTrackerProps): React.ReactElement {
  const sorted = [...campaigns].sort((a, b) => b.spend - a.spend).slice(0, 5);
  const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);

  return (
    <section data-testid="budget-tracker" className={styles.section}>
      <h3 className={styles.title}>Anggaran</h3>
      <p className={styles.honestNote}>
        Progress bar spend-vs-budget per-campaign belum tersedia — tidak ada field budget/cap
        per-campaign yang real di data Meta Ads saat ini (hanya budget bulanan tenant-wide di
        Objective). Di bawah ini real spend per-campaign tanpa bar fabrikasi.
      </p>
      <p className={styles.total}>Total Spend: {formatIdr(totalSpend)}</p>
      {sorted.length > 0 ? (
        <ul className={styles.list}>
          {sorted.map((campaign) => (
            <li key={campaign.id} className={styles.row}>
              <span className={styles.name}>{campaign.name}</span>
              <span className={styles.spend}>{formatIdr(campaign.spend)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default BudgetTracker;
