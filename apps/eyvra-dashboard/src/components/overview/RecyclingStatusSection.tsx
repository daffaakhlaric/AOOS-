import type { OverviewRecyclingSummaryDto } from "@/types/dashboard.types";

import styles from "./RecyclingStatusSection.module.css";

/**
 * Recycling "today" summary (spec "BAGIAN 9"). REAL FINDING correcting the pasted spec: it assumes
 * a per-lead `activeRecycles` list — O1's real `OverviewResponseDto.recycling` is
 * `RecyclingService.getTodaySummary`'s real 3-number summary only (`sentToday`/`respondedToday`/
 * `onCooldown`, see `RecyclingTodaySummary`'s own doc), no per-lead breakdown. The full per-lead
 * recycling list already has a real, dedicated home — `/clara/recycling` — so this section stays
 * counts-only rather than re-fetching that page's own data here.
 */
export function RecyclingStatusSection({
  recycling,
}: {
  readonly recycling?: OverviewRecyclingSummaryDto;
}): React.ReactElement {
  if (recycling === undefined) {
    return <p className={styles.unavailable}>Data recycling tidak tersedia</p>;
  }

  return (
    <div className={styles.row} data-testid="recycling-status">
      <div className={styles.cell}>
        <p className={styles.label}>Dikirim</p>
        <p className={styles.value}>{recycling.sentToday}</p>
      </div>
      <div className={styles.cell}>
        <p className={styles.label}>Respon</p>
        <p className={styles.value} style={{ color: "var(--green)" }}>
          {recycling.respondedToday}
        </p>
      </div>
      <div className={styles.cell}>
        <p className={styles.label}>Cooldown</p>
        <p className={styles.value} style={{ color: "var(--gray-500)" }}>
          {recycling.onCooldown}
        </p>
      </div>
    </div>
  );
}
