import { formatIdrCompact, formatNumber } from "@/lib/formatters";

import styles from "./SummaryCards.module.css";

export interface SummaryCardsData {
  readonly hotLeads: number;
  readonly leadsTotal: number;
  readonly testDrive: number;
  readonly spk: number;
  readonly komisiTotal: number;
  /** Meta Ads-sourced — undefined when there's no cached `/meta-ads` pull yet (see
   * `DashboardClient.tsx`'s docstring: the Overview page reads Meta data from the SAME
   * `localStorage` cache `/meta-ads` already writes to, via `readCampaignsCache()`, and never
   * calls `/api/campaigns` itself — so this is genuinely absent, not merely loading, until the
   * user has visited "Kampanye" and pulled data at least once). Omitted (not shown as 0/blank)
   * when undefined, same contract the pre-rebuild `SummaryCards` already established for
   * Meta-sourced fields. */
  readonly belanjaIklan?: number;
}

interface Cell {
  readonly label: string;
  readonly rawValue: number;
  readonly formatted: string;
  readonly period: string;
  /** Reference screenshot: Hot Leads is blue, Komisi Total is green, everything else stays black. */
  readonly accent?: "blue" | "green";
}

/**
 * Overview KPI strip (FINAL UI REBUILD, matching the reference screenshot's 6-cell strip exactly:
 * HOT LEADS / LEADS TOTAL / TEST DRIVE / SPK / KOMISI TOTAL / BELANJA IKLAN, each with a small
 * "bulan ini"/"30 hari terakhir" period caption). Restyled from the old 4-card Tremor `<Grid>` of
 * `MetricCard`s to the same flat bordered-strip pattern `MetricsSummaryBar.tsx` already
 * established for the Kampanye page, since the reference shows the exact same visual language on
 * both pages.
 *
 * Every value here is real: Hot Leads/Leads Total come from `aaos-api`'s `GET /api/v1/leads`,
 * Test Drive/SPK/Komisi Total from `GET /api/v1/closings` (`closingType` counts + `SUM
 * commissionIdr`), Belanja Iklan from the cached `/meta-ads` pull's `totals.spend` — all computed
 * by `DashboardClient.tsx`, never re-derived or invented here.
 */
export function SummaryCards({ data }: { readonly data: SummaryCardsData }): React.ReactElement {
  const cells: Cell[] = [
    {
      label: "Hot Leads",
      rawValue: data.hotLeads,
      formatted: formatNumber(data.hotLeads),
      period: "bulan ini",
      accent: "blue",
    },
    {
      label: "Leads Total",
      rawValue: data.leadsTotal,
      formatted: formatNumber(data.leadsTotal),
      period: "bulan ini",
    },
    {
      label: "Test Drive",
      rawValue: data.testDrive,
      formatted: formatNumber(data.testDrive),
      period: "bulan ini",
    },
    { label: "SPK", rawValue: data.spk, formatted: formatNumber(data.spk), period: "bulan ini" },
    {
      label: "Komisi Total",
      rawValue: data.komisiTotal,
      formatted: formatIdrCompact(data.komisiTotal),
      period: "bulan ini",
      accent: "green",
    },
  ];
  if (data.belanjaIklan !== undefined) {
    cells.push({
      label: "Belanja Iklan",
      rawValue: data.belanjaIklan,
      formatted: formatIdrCompact(data.belanjaIklan),
      period: "30 hari terakhir",
    });
  }

  return (
    <div data-testid="summary-cards" className={styles.strip}>
      {cells.map((cell) => {
        const isZero = cell.rawValue === 0;
        const valueClass = isZero
          ? styles.valueZero
          : cell.accent === "blue"
            ? styles.valueBlue
            : cell.accent === "green"
              ? styles.valueGreen
              : "";
        return (
          <div key={cell.label} className={styles.cell}>
            <p className={styles.label}>{cell.label}</p>
            <p className={`${styles.value} ${valueClass}`}>{cell.formatted}</p>
            <p className={styles.period}>{cell.period}</p>
          </div>
        );
      })}
    </div>
  );
}
