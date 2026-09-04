import Link from "next/link";

import styles from "./BranchSummary.module.css";

export interface BranchSummaryRow {
  readonly branchId: string;
  readonly displayName: string;
  readonly leadsTotal: number;
  readonly hotCount: number;
  readonly spkThisMonth: number;
}

/** Decorative per-branch identity color (cycled by index) — reference screenshot gives each
 * branch card its own dot color; nothing in the real data model assigns branches a color, so this
 * is presentation-only, not derived from/implying any real per-branch metric. */
const DOT_CLASSES = ["dotBlue", "dotGreen", "dotAmber", "dotGray"] as const;

/**
 * "Ringkasan per Cabang" — one card per real branch (FINAL UI REBUILD, reference screenshot: 4
 * cabang side-by-side, each showing Total Leads / HOT count / SPK bulan ini). Branches come from
 * the real `GET /api/branches` response (`DashboardClient.tsx`), not a hardcoded list, so this
 * renders however many branches `aaos-api` actually returns.
 */
export function BranchSummary({
  rows,
}: {
  readonly rows: readonly BranchSummaryRow[];
}): React.ReactElement {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <p className={styles.title}>🏢 Ringkasan per Cabang</p>
        <Link href="/branches" className={styles.link}>
          Branch Settings →
        </Link>
      </div>
      <div data-testid="branch-summary" className={styles.grid}>
        {rows.map((row, index) => {
          const dotClass = DOT_CLASSES[index % DOT_CLASSES.length] ?? "dotGray";
          return (
            <div key={row.branchId} className={styles.card}>
              <p className={styles.branchName}>
                <span aria-hidden="true" className={`${styles.dot} ${styles[dotClass] ?? ""}`} />
                {row.displayName}
              </p>
              <p className={styles.leadsTotal}>{row.leadsTotal} leads total</p>
              <p className={`${styles.hotCount} ${row.hotCount === 0 ? styles.hotCountZero : ""}`}>
                {row.hotCount} HOT
              </p>
              <p className={styles.spk}>{row.spkThisMonth} SPK bulan ini</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
