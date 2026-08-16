import { Card, Metric, Text } from "@tremor/react";

import styles from "./MetricCard.module.css";

export interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly changePercent?: number;
}

/**
 * A single KPI card (spec "components/ui/MetricCard.tsx" — the 4 "Overview Bulan Ini" cards render
 * through this; TOTAL UI REBUILD spec: "=== KPI STRIP ===" cell typography — 11px uppercase
 * tracking-wide label, 26px/700 value, 11px subvalue).
 *
 * TREMOR REBUILD spec STEP 17 names `Card`/`Metric`/`Text` for Overview's KPI cards — real Tremor
 * components now provide this card's structure/typography (`Card` for the bordered container,
 * `Text` for the label, `Metric` for the big value), styled via `MetricCard.module.css` classNames
 * passed straight through (all three forward `className`/arbitrary HTML attributes).
 *
 * Deliberately NOT using Tremor's `BadgeDelta` for the change indicator: `BadgeDelta` renders its
 * direction as an SVG icon, not a queryable text character, which would silently break this
 * component's real, already-passing tests (`MetricCard.test.tsx`/`SummaryCards.test.tsx` assert on
 * the literal "↑"/"↓" text already established as this app's one delta convention — also used by
 * `CampaignFunnelBar`/`VerdictBadge` elsewhere) for a purely cosmetic swap. The `↑`/`↓` span below
 * keeps that same real, tested, established convention while still living inside real Tremor `Card`/
 * `Metric`/`Text` markup.
 */
export function MetricCard({ label, value, changePercent }: MetricCardProps): React.ReactElement {
  const isPositive = changePercent !== undefined && changePercent >= 0;
  return (
    <Card data-testid="metric-card" className={styles.card}>
      <Text className={styles.label}>{label}</Text>
      <Metric className={styles.value}>{value}</Metric>
      {changePercent !== undefined ? (
        <p
          data-testid="metric-card-change"
          data-direction={isPositive ? "positive" : "negative"}
          className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}
        >
          {isPositive ? "↑" : "↓"} {Math.abs(changePercent)}%
        </p>
      ) : null}
    </Card>
  );
}
