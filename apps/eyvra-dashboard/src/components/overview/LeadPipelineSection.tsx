import type { OverviewLeadsSummaryDto } from "@/types/dashboard.types";

import styles from "./LeadPipelineSection.module.css";

/**
 * HOT/WARM/COLD lead pipeline (spec "BAGIAN 8"). REAL FINDING correcting the pasted spec: it
 * assumes a per-lead `Lead[]` array (name/phone/handoff status per row) — O1's real
 * `OverviewResponseDto.leads` only carries CURRENT aggregate counts
 * (`OverviewLeadsSummaryDto.hot`/`warm`/`cold`/`hotToday`/`hotYesterday`), not individual lead
 * rows (see that interface's own doc — it fans out `LeadsService.getLeadsByBranch` across every
 * branch and only keeps the counts, per `OverviewService.getLeadsSummary`). Rather than add a
 * second `/api/leads` fetch here (a real, separate data pull this phase's scope doesn't call for —
 * `/clara/contacts`/`/clara/inbox` already own the per-lead list UI), this section honestly shows
 * counts only.
 *
 * COLORFUL BRAND GUIDELINE V2 (Phase B3, Prompt 8): each column gets a colored header BAND (not
 * just colored text on a plain background) per `--v2-hot`/`--v2-warm`/`--v2-cold` (+ their `-tint`
 * background pairs) — this component shows aggregate COUNTS only (confirmed above, real finding
 * from the earlier Overview Monitor effort), so there is no real per-lead row list to add colored
 * left borders/badges to; only the count/header band treatment that actually exists here is
 * recolored.
 */
export function LeadPipelineSection({
  leads,
}: {
  readonly leads?: OverviewLeadsSummaryDto;
}): React.ReactElement {
  if (leads === undefined) {
    return <p className={styles.unavailable}>Data lead tidak tersedia</p>;
  }

  return (
    <div className={styles.columns} data-testid="lead-pipeline">
      <div className={`${styles.column} ${styles.columnHot}`}>
        <p className={styles.title} style={{ color: "var(--v2-hot)" }}>
          HOT
        </p>
        <p className={styles.count} style={{ color: "var(--v2-hot)" }}>
          {leads.hot}
        </p>
        <p className={styles.caption}>
          {leads.hotToday} hari ini
          {leads.hotDeltaVsYesterday !== 0
            ? ` (${leads.hotDeltaVsYesterday >= 0 ? "+" : ""}${leads.hotDeltaVsYesterday} vs kemarin)`
            : ""}
        </p>
      </div>
      <div className={`${styles.column} ${styles.columnWarm}`}>
        <p className={styles.title} style={{ color: "var(--v2-warm)" }}>
          WARM
        </p>
        <p className={styles.count} style={{ color: "var(--v2-warm)" }}>
          {leads.warm}
        </p>
        <p className={styles.caption}>total saat ini</p>
      </div>
      <div className={`${styles.column} ${styles.columnCold}`}>
        <p className={styles.title} style={{ color: "var(--v2-cold)" }}>
          COLD
        </p>
        <p className={styles.count} style={{ color: "var(--v2-cold)" }}>
          {leads.cold}
        </p>
        <p className={styles.caption}>total saat ini</p>
      </div>
    </div>
  );
}
