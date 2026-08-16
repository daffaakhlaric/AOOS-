import { formatIdrCompact, formatNumber } from "@/lib/formatters";
import type { AdMetricsDto } from "@/types/dashboard.types";

import styles from "./MetricsSummaryBar.module.css";

export interface MetricsSummaryBarProps {
  readonly totals: AdMetricsDto;
  /** Number of campaigns/ads in the current pull (spec "meta-ads/page.tsx" MAAO2 redesign summary bar: "KAMPANYE · IKLAN" columns). Optional so existing callers passing just `totals` keep compiling. */
  readonly campaignCount?: number;
  readonly adCount?: number;
}

interface Item {
  readonly label: string;
  readonly rawValue: number;
  readonly formatted: string;
  /** BELANJA (spend) is always black per spec; D3/TOTAL LEAD get the blue highlight. */
  readonly highlight?: boolean;
}

/** Belanja · Chat · D2 · D3 · D5 · Form · Total Lead (· Kampanye · Iklan, when counts are given) KPI strip (spec "components/meta-ads/MetricsSummaryBar.tsx"; TOTAL UI REBUILD "=== KPI STRIP ==="). */
export function MetricsSummaryBar({
  totals,
  campaignCount,
  adCount,
}: MetricsSummaryBarProps): React.ReactElement {
  const items: Item[] = [
    { label: "Belanja", rawValue: totals.spend, formatted: formatIdrCompact(totals.spend) },
    {
      label: "Chat",
      rawValue: totals.conversations,
      formatted: formatNumber(totals.conversations),
    },
    { label: "D2", rawValue: totals.d2, formatted: formatNumber(totals.d2) },
    { label: "D3", rawValue: totals.d3, formatted: formatNumber(totals.d3), highlight: true },
    { label: "D5", rawValue: totals.d5, formatted: formatNumber(totals.d5) },
    { label: "Form", rawValue: totals.leadForm, formatted: formatNumber(totals.leadForm) },
    {
      label: "Total Lead",
      rawValue: totals.totalLead,
      formatted: formatNumber(totals.totalLead),
      highlight: true,
    },
  ];
  if (campaignCount !== undefined) {
    items.push({
      label: "Kampanye",
      rawValue: campaignCount,
      formatted: formatNumber(campaignCount),
    });
  }
  if (adCount !== undefined) {
    items.push({ label: "Iklan", rawValue: adCount, formatted: formatNumber(adCount) });
  }
  return (
    <div data-testid="metrics-summary-bar" className={styles.strip}>
      {items.map((item) => {
        const isZero = item.rawValue === 0;
        const valueClass = isZero
          ? styles.valueZero
          : item.highlight === true
            ? styles.valueBlue
            : "";
        return (
          <div key={item.label} className={styles.cell}>
            <p className={styles.label}>{item.label}</p>
            <p className={`${styles.value} ${valueClass}`}>{item.formatted}</p>
          </div>
        );
      })}
    </div>
  );
}
