import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import type { AccountSummaryResponseDto } from "@/types/dashboard.types";

import { PanelHeader, SummaryRow } from "./SummaryPanelParts";
import styles from "./AttentionSummary.module.css";

/**
 * Real account-wide opportunity summary, structurally identical to `NeedsAttentionSummary` (the
 * reference shows the two as a matched pair), driven by the real Opportunity Engine output on the
 * account summary (`SCALING_OPPORTUNITY` / `CREATIVE_WINNER_EXPANSION`).
 *
 * Two of the reference's four rows have NO real source in this codebase and stay honest em-dashes —
 * `opportunities/domain/opportunity.ts`'s own header documents why: there is no real budget-headroom
 * formula (so no "Rp X/day scaling headroom") and no account-wide "creatives needed" count.
 * Rendering a `0` there would read as "we checked and found none", which would be false.
 *
 * The rows now always render — even at zero opportunities — so the card keeps the reference's shape
 * and stays visually matched to Needs Attention instead of collapsing into a full-card empty state.
 */
export function OpportunitySummary({
  summary,
  error,
}: {
  readonly summary?: AccountSummaryResponseDto;
  readonly error?: string;
}): React.ReactElement {
  if (error !== undefined) {
    return (
      <div
        className={`${styles.panel} ${styles.panelOpportunity}`}
        data-testid="cc-panel-opportunity"
      >
        <PanelHeader label="Opportunities" countClassName={styles.totalBadgeSuccess} />
        <ErrorState message={error} />
      </div>
    );
  }

  if (summary === undefined) {
    return (
      <div
        className={`${styles.panel} ${styles.panelOpportunity}`}
        data-testid="cc-panel-opportunity"
      >
        <PanelHeader label="Opportunities" countClassName={styles.totalBadgeSuccess} />
        <LoadingState processLabel="Samantha sedang mencari peluang..." />
      </div>
    );
  }

  const scaling = summary.opportunities.filter(
    (opportunity) => opportunity.type === "SCALING_OPPORTUNITY",
  );
  const creativeWinners = summary.opportunities.filter(
    (opportunity) => opportunity.type === "CREATIVE_WINNER_EXPANSION",
  );

  return (
    <div
      className={`${styles.panel} ${styles.panelOpportunity}`}
      data-testid="cc-panel-opportunity"
    >
      <PanelHeader
        label="Opportunities"
        count={summary.opportunities.length}
        countClassName={styles.totalBadgeSuccess}
      />
      <div className={styles.rows}>
        <SummaryRow
          dotClassName={styles.dotSuccess}
          value={String(scaling.length)}
          label="Scaling candidates"
          note="Sinyal performa positif yang cukup kuat untuk di-scale"
          title={scaling[0]?.evidence}
        />
        <SummaryRow
          dotClassName={styles.dotMuted}
          label="Scaling headroom"
          note="Belum ada perhitungan headroom budget yang nyata"
          unavailable
        />
        <SummaryRow
          dotClassName={styles.dotMuted}
          label="New creatives needed"
          note="Belum ada hitungan kebutuhan creative per akun"
          unavailable
        />
        <SummaryRow
          dotClassName={styles.dotSuccess}
          value={String(creativeWinners.length)}
          label="Winning concepts"
          note="Angle terbaik, siap diperluas ke variasi baru"
          title={creativeWinners[0]?.description}
        />
      </div>
    </div>
  );
}
