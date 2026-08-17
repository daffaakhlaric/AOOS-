import { formatNumber } from "@/lib/formatters";
import type { AdMetricsDto } from "@/types/dashboard.types";

import styles from "./CampaignFunnelBar.module.css";

/**
 * Mini funnel: Klik → Chat → D2 → D3 → D5 → Form (spec "components/meta-ads/CampaignFunnelBar.tsx";
 * MAAO2 redesign mockup additionally lists a "WA" stage between Klik and Chat — dropped here since
 * `aaos-api`'s real per-ad metrics (`AdMetricsResponseDto`) have no field distinct from
 * `conversations`/Chat for it; inventing one would just duplicate Chat's number under a different
 * label).
 *
 * Real bug fix (FINAL UI REBUILD, matching the user's reference screenshot): rebuilt from the
 * TOTAL UI REBUILD pass's inline "Klik → Chat → ..." arrow-separated text into the reference's
 * boxed 6-column grid, each cell showing a percentage-of-clicks figure and a mini progress bar
 * under the number — `AdRow`'s "FUNNEL STRIP" in `docs/PROMPT-AAOS-DASHBOARD-FINAL-UI-REBUILD.md`.
 * The percentage and bar width are both `value / clicks` (falling back to 0% when `clicks` is 0)
 * — a real, derived ratio from already-fetched data, not a fabricated number.
 */
export function CampaignFunnelBar({
  metrics,
}: {
  readonly metrics: AdMetricsDto;
}): React.ReactElement {
  const steps: ReadonlyArray<{ label: string; value: number; highlight?: boolean }> = [
    { label: "Klik", value: metrics.clicks },
    { label: "Chat", value: metrics.conversations },
    { label: "D2", value: metrics.d2 },
    { label: "D3", value: metrics.d3, highlight: true },
    { label: "D5", value: metrics.d5 },
    { label: "Form", value: metrics.leadForm },
  ];
  return (
    <div data-testid="campaign-funnel-bar" className={styles.grid}>
      {steps.map((step) => {
        const pct = metrics.clicks > 0 ? Math.round((step.value / metrics.clicks) * 100) : 0;
        const numberClass =
          step.value === 0
            ? styles.numberZero
            : step.highlight === true
              ? styles.numberHighlight
              : "";
        const barClass = step.highlight === true ? styles.barFillHighlight : styles.barFillDefault;
        return (
          <div key={step.label} className={styles.cell}>
            <div className={styles.cellHead}>
              <span className={styles.label}>{step.label}</span>
              <span className={styles.pct}>{pct}%</span>
            </div>
            <span className={`${styles.number} ${numberClass}`}>{formatNumber(step.value)}</span>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${barClass}`}
                style={step.value > 0 ? { width: `${pct}%` } : { width: 0, opacity: 0 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
